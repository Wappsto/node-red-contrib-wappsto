const wappsto = new Wappsto();
var keyModel, locationModel, temperatureModel;

window.onload = function() {
  /* Find and assign listeners to the forms */
  var f1 = document.getElementById('apiKey').parentElement;
  var f2 = document.getElementById('country').parentElement;
  f1.onsubmit = setApiKey;
  f2.onsubmit = getTemperature;
};

function setApiKey(event) {
  event.preventDefault();
  var form = event.srcElement.elements;
  keyModel.save({ apiKey: form.apiKey.value });
}

function getTemperature(event) {
  event.preventDefault();
  var city = event.srcElement.elements.city.value;
  var country = event.srcElement.elements.country.value;
  var json = JSON.stringify({ city: city, country: country });

  if (locationModel) {
    locationModel.save({ data: json }, { patch: true });
  } else {
    getValues().then(function() {
      locationModel.save({ data: json }, { patch: true });
    }).catch(function(err) {
      console.error(err);
    });
  }
}

function getValues(city, coun) {
  return new Promise(function(resolve, reject) {
    wappsto.get('value', {}, { expand: 1, subscribe: true })
      .then(function(collection) {
        locationModel = collection.find({name: 'location'}).get('state.0');
        temperatureModel = collection.find({name: 'temperature'}).get('state.0');
        temperatureModel.on('change:data', function(model) {
          document.getElementsByTagName('span')[0].innerHTML = model.get('data');
        });
        resolve();
      }).catch(reject);
  });
}

wappsto.get('data', {}, { expand: 1 })
  .then(function(collection) {
    keyModel = collection.at(0);
    document.getElementById('apiKey').value = keyModel.get('apiKey') || '';
  }).catch(function() {
    keyModel = new wappsto.models.Data();
  });

getValues().then(function() {
  var obj = JSON.parse(locationModel.get('data'));
  document.getElementById('country').value = obj.country;
  document.getElementById('city').value = obj.city;
  document.getElementsByTagName('span')[0].innerHTML = temperatureModel.get('data');
}).catch(function(err) {
  console.error(err);
});
