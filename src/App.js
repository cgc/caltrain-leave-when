import React, { Component } from 'react';
import './App.css';
import stops from '../data/caltrain/stops';
import stopTimes from '../data/caltrain/stop_times';
import trips from '../data/caltrain/trips';
import calendar from '../data/caltrain/calendar';
import calendarDates from '../data/caltrain/calendar_dates';
import routes from '../data/caltrain/routes';
import {groupBy,minBy} from 'lodash';
import moment from 'moment';

for (const time of stopTimes) {
  if (!time.trip_id) {
    continue;
  }
  time.stop_sequence = parseInt(time.stop_sequence);
  // we only deal in arrival_time because it is equal to departure_time
  let [hours, minutes, seconds] = time.arrival_time.split(':');
  hours = parseInt(hours);
  let day = 0;
  // GTFS lets hours roll over for after-midnight service.
  if (hours >= 24) {
    hours -= 24;
    day = 1;
  }
  time.arrival_time = moment([hours, minutes, seconds].join(':'), 'h:mm:ss').add(day, 'day');
}
const stopTimesByTrip = groupBy(stopTimes, 'trip_id');
/*
for (const tripId of Object.keys(stopTimesByTrip)) {
  const times = stopTimesByTrip[tripId];
  // XXX should we time-order the data?
  //times.sort((time1, time2) => time1.stop_sequence - time2.stop_sequence);
}
*/

const stopOptions = stops
  .filter(stop => !stop.parent_station)
  .map(stop => {
    const name = stop.stop_name
      .replace(' Caltrain', '')
      .replace(' Station', '');
    return <option key={stop.stop_id} value={stop.stop_id}>{name}</option>;
  });
stopOptions.unshift(<option key="" value="">---</option>)

const dayToString = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function serviceIdForDate(dateString) {
  // look in calendar dates XXX
  const dayOfWeek = dayToString[moment(dateString).day()];
  return calendar.find(c => c[dayOfWeek] === '1')['service_id'];
}

function preciseHumanize(duration) {
  const result = [];
  if (duration.hours()) {
    result.push(`${duration.hours()}h`);
  }
  if (duration.minutes()) {
    result.push(`${duration.minutes()}m`);
  }
  return result.join(' ');
}

function tripsForServiceId(serviceId, fromStopId, toStopId) {
  const fromStopIds = stops.filter(s => s.parent_station === fromStopId).map(s => s.stop_id);
  const toStopIds = stops.filter(s => s.parent_station === toStopId).map(s => s.stop_id);
  const result = [];
  for (const trip of trips) {
    if (trip.service_id !== serviceId) {
      continue;
    }
    const stopTimes = stopTimesByTrip[trip.trip_id];
    const from = stopTimes.find(st => fromStopIds.includes(st.stop_id));
    const to = stopTimes.find(st => toStopIds.includes(st.stop_id));
    if (!from || !to || from.arrival_time > to.arrival_time) {
      // stop isn't on this trip, or wrong direction!
      continue;
    }
    const route = routes.find(r => r.route_id === trip.route_id);
    const name = `${route.route_long_name} #${trip.trip_short_name}`;
    const duration = preciseHumanize(moment.duration(to.arrival_time.diff(from.arrival_time)));

    result.push({
      trip_id: trip.trip_id,
      start: from.arrival_time,
      end: to.arrival_time,
      duration,
      name,
    });
  }
  return result;
}

function findNearestStop(lat, lon) {
  return minBy(stops, s =>
    Math.pow(parseFloat(s.stop_lat) - lat, 2) + Math.pow(parseFloat(s.stop_lon) - lon, 2)
  ).stop_id;
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      from: "",
      to: "",
      date: moment().format('YYYY-MM-DD'),
    };
    this.onChangeFrom = this.onChangeFrom.bind(this);
    this.onChangeTo = this.onChangeTo.bind(this);
    this.reverse = this.reverse.bind(this);
    this.onChangeDate = this.onChangeDate.bind(this);
    this.findNearest = this.findNearest.bind(this);
  }

  onChangeFrom(e) {
    this.setState({ from: e.target.value });
  }

  onChangeTo(e) {
    this.setState({ to: e.target.value });
  }

  onChangeDate(e) {
    this.setState({ date: e.target.value });
  }

  reverse(e) {
    this.setState({
      from: this.state.to,
      to: this.state.from,
    });
  }

  findNearest() {
    navigator.geolocation.getCurrentPosition(function(position) {
      this.setState({
        from: findNearestStop(position.coords.latitude, position.coords.longitude)
      });
    });
  }

  render() {
    const now = moment();
    let renderedTrips;
    if (!this.state.from || !this.state.to || this.state.from === this.state.to) {
      renderedTrips = 'Select two different stops';
    } else {
      renderedTrips = tripsForServiceId(
        serviceIdForDate(this.state.date), this.state.from, this.state.to
      ).map(trip => {
        // is over?
        // colors for limited vs bullet vs not
        // XXX doesn't work after midnight b/c we don't really parse arrival_time well
        const className = trip.end < now ? 'is-over' : trip.start < now ? 'is-active' : '';
        return (
          <div className={'Trip ' + className} key={trip.trip_id}>
            <div className="Trip-info">
              <span>{trip.name}</span>
              <span>{trip.duration}</span>
            </div>
            <div>{trip.start.format('h:mma')} &rarr; {trip.end.format('h:mma')}</div>
          </div>
        );
      });
    }
    return (
      <div className="App">
        <div className="App-header">
          <button onClick={this.findNearest}>&#8982;</button>
          <select value={this.state.from} onChange={this.onChangeFrom}>
            {stopOptions}</select>
          &rarr;
          <select value={this.state.to} onChange={this.onChangeTo}>
            {stopOptions}</select>
          <button onClick={this.reverse} title="reverse the direction">&darr;&uarr;</button>
          <input type="date" value={this.state.date} onChange={this.onChangeDate} />
        </div>
        <div className="App-body">
          <div className="Trips">
            {renderedTrips}
          </div>
        </div>
      </div>
    );
  }
}

export default App;
