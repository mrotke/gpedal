import {ssci} from './lib/smoothKernel';
import {timeout} from './lib/utils';
import {getElevationAlongPath} from './lib/gmapPromises';
import {managedLocalStorage} from './lib/managedLocalStorage';
import md5 from 'blueimp-md5';

export class RoutePoint {
  constructor({elevation, grade, smoothedGrade, distance, heading, climb, opposite, location}) {
    this.elevation = elevation;
    this.grade = grade;
    this.smoothedGrade = smoothedGrade;
    this.distance = distance;
    this.heading = heading;
    this.climb = climb;
    this.opposite = opposite;

    if(location instanceof google.maps.LatLng) {
      this.location = location;
    } else {
      this.location = new google.maps.LatLng(location.lat, location.lng);
    }
  }

  toJSON() {
    let {elevation, grade, smoothedGrade, distance, heading, climb, opposite} = this;
    let location = this.location.toJSON();
    return {elevation, grade, smoothedGrade, distance, heading, climb, opposite, location};
  }

  static fromJSON(obj) {
    return new RoutePoint(obj);
  }
}

export class GPXRoutePointFactory {
  constructor (fileBody) {
    this.fileBody = fileBody;
    this.md5 = md5(fileBody);
    this.points = [];
  }

  expandPointsWithGradeAndHeading() {
    for(let x=0; x<this.points.length; x++) {
      let p1 = this.points[x];
      if(x < (this.points.length - 1)) {
        let p2 = this.points[x+1];
        p1.heading = google.maps.geometry.spherical.computeHeading(p1.location, p2.location);
        let adjacent = google.maps.geometry.spherical.computeDistanceBetween(p1.location, p2.location);
        let opposite = p2.elevation - p1.elevation;
        p1.distance = adjacent;
        p1.grade = 100 * (opposite / adjacent);
        p1.opposite = opposite;
        p1.climb = opposite;
      } else {
        p1.distance = 0;
        p1.heading = 0;
        p1.grade = 0;
        p1.opposite = 0;
        p1.climb = 0;
      }
    }
    let grades = this.points.map((p,i) => {return [i,p.grade]});

    let smoothed_grades_obj = ssci.smooth.kernel2()
    		                      .kernel("Gaussian")
    		                      .data(grades)
    		                      .scale(2);
    smoothed_grades_obj();
    let smoothed_grades = smoothed_grades_obj.output();
    for(let x=0; x<this.points.length; x++) {
      this.points[x].smoothedGrade = smoothed_grades[x][1];
      if(this.points[x].smoothedGrade < 0.95 || this.points[x].climb < 0) {
        this.points[x].climb = 0;
      }
    }
  }

  /**
  Resample the GPX points to evenly spaced points (like the Elevation service's
  getElevationAlongPath does) using the elevations stored in the file.  Missing
  elevations are interpolated from neighbouring points.
  */
  expandPointsWithGPXElevation(gpxPoints, desiredDistanceBetween=20) {
    let spherical = google.maps.geometry.spherical;

    // Cumulative distance along the track, dropping zero length segments
    let track = [];
    let total = 0;
    for(let p of gpxPoints) {
      if(track.length > 0) {
        let d = spherical.computeDistanceBetween(track[track.length-1].point.location, p.location);
        if(d === 0) {
          continue;
        }
        total += d;
      }
      track.push({point: p, at: total});
    }

    let known = track.filter(t => t.point.elevation !== undefined);
    if(known.length === 0) {
      known = [{point: {elevation: 0}, at: 0}];
    }
    let k = 0;
    for(let t of track) {
      if(t.point.elevation === undefined) {
        while(k < known.length - 1 && known[k+1].at < t.at) {
          k++;
        }
        let a = known[k], b = known[Math.min(k+1, known.length-1)];
        if(t.at <= a.at || a === b) {
          t.point.elevation = a.point.elevation;
        } else if(t.at >= b.at) {
          t.point.elevation = b.point.elevation;
        } else {
          t.point.elevation = a.point.elevation + (b.point.elevation - a.point.elevation) * (t.at - a.at) / (b.at - a.at);
        }
      }
    }

    if(track.length < 2) {
      this.points = track.map(t => new RoutePoint({elevation: t.point.elevation, location: t.point.location}));
      return;
    }

    let samples = Math.max(1, Math.ceil(total / desiredDistanceBetween));
    let step = total / samples;
    let seg = 0;
    for(let i=0; i<=samples; i++) {
      let at = (i === samples) ? total : i * step;
      while(seg < track.length - 2 && track[seg+1].at < at) {
        seg++;
      }
      let a = track[seg], b = track[seg+1];
      let fraction = Math.min(1, Math.max(0, (at - a.at) / (b.at - a.at)));
      this.points.push(new RoutePoint({
        elevation: a.point.elevation + (b.point.elevation - a.point.elevation) * fraction,
        location: spherical.interpolate(a.point.location, b.point.location, fraction)
      }));
    }
  }

  async expandPointsWithElevation(gpxPoints) {
    let start=0;
    let desiredDistanceBetween = 20;
    let maxPoints = 512;
    let maxDistance = maxPoints * desiredDistanceBetween;

    while(start < gpxPoints.length) {
      if(start > 0) {
        await timeout(4000);
      }

      let points_slice = [];
      let distance_slice = 0;
      let count_slice = 0;
      for(let x=start; x<gpxPoints.length; x++) {
        let p1 = gpxPoints[x];
        let distance = 0;
        if(x < (gpxPoints.length - 1)) {
          let p2 = gpxPoints[x+1];
          distance = google.maps.geometry.spherical.computeDistanceBetween(p1.location, p2.location);
        }
        distance_slice += distance;
        count_slice += 1;
        if(distance_slice <= maxDistance && count_slice < maxPoints) {
          points_slice.push(p1.location);
        } else {
          count_slice -= 1;
          distance_slice -= distance;
          break;
        }
      }

      let elevationRequest = {
        'path': points_slice,
        'samples': Math.ceil(distance_slice / desiredDistanceBetween),
      }

      let elevations = await getElevationAlongPath(elevationRequest);
      let elevationPoints = elevations.map(e => {
        return new RoutePoint({elevation: e.elevation, location: e.location});
      });
      Array.prototype.push.apply(this.points, elevationPoints);
      start = count_slice + start;
    }
  }

  async create() {
    let cacheName = 'gpx-cache-' + this.md5;
    let raw = managedLocalStorage.get(cacheName)
    if(raw !== undefined && raw !== null) {
      managedLocalStorage.unshift('gpx-cache', cacheName);
      this.points = raw.map(r => {return RoutePoint.fromJSON(r)});
    } else {
      let gpxParser = new DOMParser();
      let gpxDom = gpxParser.parseFromString(this.fileBody, "text/xml");
      let gpxNodes = Array.from(gpxDom.documentElement.getElementsByTagName('trkpt'));
      if(gpxNodes.length === 0) {
        // Route (planned course) files use <rte><rtept> instead of tracks
        gpxNodes = Array.from(gpxDom.documentElement.getElementsByTagName('rtept'));
      }
      let gpxPoints = gpxNodes.map(p => {
        let lat = parseFloat(p.getAttribute('lat')),
            lng = parseFloat(p.getAttribute('lon'));

        let elevation = undefined;
        let $ele = p.getElementsByTagName('ele')[0];
        if($ele) {
          elevation = parseFloat($ele.textContent);
          if(!isFinite(elevation)) {
            elevation = undefined;
          }
        }

        return new RoutePoint({elevation, location: {lat, lng}});
      });

      if(gpxPoints.some(p => p.elevation !== undefined)) {
        this.expandPointsWithGPXElevation(gpxPoints);
      } else {
        try {
          await this.expandPointsWithElevation(gpxPoints);
        } catch(error) {
          // e.g. the Google Maps API key can't use the Elevation service
          console.warn('Elevation service failed, the route will be flat: ', error);
          gpxPoints.forEach(p => p.elevation = 0);
          this.points = [];
          this.expandPointsWithGPXElevation(gpxPoints);
        }
      }
      this.expandPointsWithGradeAndHeading();

      managedLocalStorage.add('gpx-cache', cacheName, this.points);
    }

    return this.points;
  }

}
