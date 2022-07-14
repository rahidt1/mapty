'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + ' ').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    // this.type = 'running';
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////////////////////////////
// Application Architecture
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const reset = document.querySelector('.reset');
const trash = document.querySelector('.icon__trash');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workout = [];
  #marker = [];

  constructor() {
    // Get user's postion
    this._getPostition();

    // Get data from local storage
    this._getLocalStorage();

    // Event Handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    /*
    containerWorkouts.addEventListener(
      'click',
      function (e) {
        console.log(e.target);
        console.log(this);
        console.log(this.workout);
        const trashBin = e.target.closest('.icon__trash');
        if (!trashBin) this._moveToPopup(e);
        else {
          const workoutEl = e.target.closest('.workout');
          if (!workoutEl) return;
          this.trash(workoutEl.dataset.id);
        }
      }.bind(this)
    );
    */
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    reset.addEventListener('click', this.reset);
    // this.workout();
  }

  // Get position from GPS
  _getPostition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  // Load map on current position
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // Display Map on current location
    this.#map = L.map('map').setView([latitude, longitude], this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling click on map
    this.#map.on('click', this._showForm.bind(this));

    // Render Marker on current Position
    this._renderCurrentWorkoutMarker([latitude, longitude]);

    // Render marker from local storage
    // See explanation at _getLocalStorage() method
    this.#workout.forEach(work => this._renderWorkoutMarker(work));
  }

  // Show form + reset button
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();

    reset.classList.remove('hidden');
  }
  // Hide form
  _hideForm() {
    // Clear inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // Workout type change
  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // Submit workout form
  _newWorkout(e) {
    e.preventDefault();

    // Helper function
    const validInput = (...inputs) =>
      inputs.every(input => Number.isFinite(input));
    const allPositive = (...inputs) => inputs.every(input => input > 0);

    // Get data from form
    // This is value attribute from html element, not value extracted from input field
    const type = inputType.value;
    // This is value extracted from input field
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if the data is valid
      if (
        !validInput(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs must be positive number');
      workout = new Running([lat, lng], distance, duration, cadence);

      /*
      if (
        !Number.isFinite(distance) ||
        !distance > 0 ||
        !Number.isFinite(duration) ||
        !duration > 0 ||
        !Number.isFinite(cadence) ||
        !cadence > 0
      ) {
        alert('Inputs must be positive numbers');
      }
      */
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if the data is valid
      if (
        !validInput(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs must be positive number');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workout.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkoutList(workout);

    // Hide form + Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }
  _renderCurrentWorkoutMarker(position) {
    L.marker(position)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidht: 100,
          autoClose: false,
          closeOnClick: false,
        })
      )
      .setPopupContent(`📍 Current Location`)
      .openPopup();
  }
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);
    this.#marker.push(marker);
    // console.log(this.#marker);
    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidht: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'}${workout.description}`
      )
      .openPopup();
  }
  _renderWorkoutList(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <ion-icon class="icon__trash" name="trash-outline"></ion-icon>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
        `;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
      `;
    }
    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;
    }
    form.insertAdjacentHTML('afterend', html);
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workout));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    // If local storage is empty, then data would be null, but if local storage is empty array data would be true, hence checking both condition
    if (!data || data.length === 0) return;
    // Reset button should be added if there is data during page load, unless it should be hidden
    reset.classList.remove('hidden');

    this.#workout = data;

    this.#workout.forEach(work => {
      this._renderWorkoutList(work);
      // Cant use, this.#map still not available
      // this._renderWorkoutMarker(work)

      // (👆) We cant directly render map marker, because we need leaflet map object (this.#map)
      // But we are handling _getLocalStorage() event when page loads, that means we defined it in App's constructor
      // That time this.#map is not loaded still, because it takes time to first get the geolocation and render the map, thats why we cant access it, so we cant call _renderWorkoutMarker()
      // For this we can call _renderWorkoutMarker() with a delay to give time to load the map (my solution)
      // Or we render the marker on map when map loads, that means in _loadMap() method (Jonas's solution)

      // setTimeout(() => this._renderWorkoutMarker(work), 1000);
    });
  }
  // Move popup
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    const trashEl = e.target.closest('.icon__trash');

    if (trashEl) {
      this.trash(workoutEl.dataset.id);
    }

    if (!workoutEl) return;

    const workout = this.#workout.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using public interface
    // workout.click();
  }
  // Delete Workout List + marker
  trash(id) {
    const removeEl = document.querySelector(`[data-id="${id}"]`);

    this.#workout.forEach((work, i) => {
      if (work.id === id) {
        this.#workout.splice(i, 1);

        // Remove marker from map
        this.#marker[i].remove();

        this.#marker.splice(i, 1);
      }
    });
    // Remove workout from local storage
    this._setLocalStorage();

    // Remove workout list element from sidebar
    removeEl.remove();

    // If no workout left, rou
    if (this.#workout.length === 0) {
      reset.style.display = 'none';
      this.reset();
    }
  }

  // Remove workout from local storage
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
  /*
  get workout() {
    return this.#workout;
  }
  */
}

const app = new App();
