const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    nav.classList.toggle('is-open');
  });
}

async function reverseGeocodeCoordinates(lat, lng) {
  try {
    const params = new URLSearchParams({ lat, lng });
    const response = await fetch(`/api/maps/reverse-geocode?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return '';
    const data = await response.json();
    return data.address || '';
  } catch (error) {
    return '';
  }
}

document.querySelectorAll('[data-use-location]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    const input = document.querySelector('input[name="currentLocation"]');
    button.textContent = 'Getting location...';
    button.disabled = true;

    navigator.geolocation.getCurrentPosition(async (position) => {
      const coordinates = `${position.coords.latitude}, ${position.coords.longitude}`;
      const address = await reverseGeocodeCoordinates(position.coords.latitude, position.coords.longitude);

      if (input) {
        input.value = address || coordinates;
        input.dataset.coordinates = coordinates;
      }
      const latField = document.querySelector('[data-location-lat]');
      const lngField = document.querySelector('[data-location-lng]');
      if (latField) latField.value = position.coords.latitude;
      if (lngField) lngField.value = position.coords.longitude;

      button.textContent = address ? 'Location Added' : 'GPS Location Added';
      button.disabled = false;
    }, () => {
      button.textContent = 'Use My Current Location';
      button.disabled = false;
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    });
  });
});

const params = new URLSearchParams(window.location.search);
const requestedService = params.get('service');
const problemInput = document.querySelector('[name="problem"]');

if (requestedService && problemInput && !problemInput.value) {
  problemInput.value = requestedService;
}

const vehicleMakeInput = document.querySelector('[data-vehicle-make]');
const vehicleModelInput = document.querySelector('[data-vehicle-model]');
const vehicleMakes = document.querySelector('#vehicleMakes');
const vehicleModels = document.querySelector('#vehicleModels');
const vehicleApiBase = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const vehicleMakeList = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler',
  'Dodge', 'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar',
  'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Lincoln', 'Lucid', 'Mazda', 'Mercedes-Benz',
  'Mercury', 'Mini', 'Mitsubishi', 'Nissan', 'Polestar', 'Pontiac', 'Porsche', 'Ram',
  'Rivian', 'Saturn', 'Scion', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];
const vehicleModelMap = {
  Acura: ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TL', 'TLX', 'TSX', 'ZDX'],
  'Alfa Romeo': ['4C', 'Giulia', 'Stelvio', 'Tonale'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'S4', 'S5', 'S6', 'TT'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'i3', 'i4', 'i7', 'i8', 'iX', 'M3', 'M4', 'M5', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
  Buick: ['Cascada', 'Century', 'Enclave', 'Encore', 'Encore GX', 'Envision', 'Envista', 'LaCrosse', 'LeSabre', 'Lucerne', 'Regal', 'Rendezvous', 'Verano'],
  Cadillac: ['ATS', 'CT4', 'CT5', 'CT6', 'CTS', 'DeVille', 'DTS', 'Eldorado', 'Escalade', 'Escalade ESV', 'Lyriq', 'SRX', 'STS', 'XT4', 'XT5', 'XT6', 'XTS'],
  Chevrolet: ['Avalanche', 'Blazer', 'Bolt EV', 'Bolt EUV', 'Camaro', 'Caprice', 'Captiva Sport', 'Cobalt', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'HHR', 'Impala', 'Malibu', 'Monte Carlo', 'Silverado 1500', 'Silverado 2500HD', 'Silverado 3500HD', 'Sonic', 'Spark', 'SS', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax', 'Uplander', 'Volt'],
  Chrysler: ['200', '300', 'Aspen', 'Crossfire', 'Pacifica', 'PT Cruiser', 'Sebring', 'Town & Country', 'Voyager'],
  Dodge: ['Avenger', 'Caliber', 'Challenger', 'Charger', 'Dakota', 'Dart', 'Durango', 'Grand Caravan', 'Journey', 'Magnum', 'Neon', 'Nitro', 'Ram 1500', 'Ram 2500', 'Ram 3500', 'Stratus', 'Viper'],
  Fiat: ['500', '500L', '500X', '124 Spider'],
  Ford: ['Bronco', 'Bronco Sport', 'C-Max', 'Crown Victoria', 'E-Series', 'EcoSport', 'Edge', 'Escape', 'Excursion', 'Expedition', 'Explorer', 'F-150', 'F-250 Super Duty', 'F-350 Super Duty', 'Fiesta', 'Flex', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Taurus', 'Thunderbird', 'Transit', 'Transit Connect'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  GMC: ['Acadia', 'Canyon', 'Envoy', 'Hummer EV', 'Savana', 'Sierra 1500', 'Sierra 2500HD', 'Sierra 3500HD', 'Terrain', 'Yukon', 'Yukon XL'],
  Honda: ['Accord', 'Civic', 'Clarity', 'CR-V', 'CR-Z', 'Crosstour', 'Element', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Prelude', 'Ridgeline', 'S2000'],
  Hyundai: ['Accent', 'Azera', 'Elantra', 'Entourage', 'Genesis', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tiburon', 'Tucson', 'Veloster', 'Venue', 'Veracruz'],
  Infiniti: ['EX35', 'FX35', 'FX45', 'G35', 'G37', 'JX35', 'M35', 'M37', 'Q40', 'Q45', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX56', 'QX60', 'QX70', 'QX80'],
  Jaguar: ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'S-Type', 'XE', 'XF', 'XJ', 'XK'],
  Jeep: ['Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Cherokee L', 'Liberty', 'Patriot', 'Renegade', 'Wagoneer', 'Grand Wagoneer', 'Wrangler'],
  Kia: ['Amanti', 'Borrego', 'Cadenza', 'Carnival', 'EV6', 'Forte', 'K5', 'K900', 'Niro', 'Optima', 'Rio', 'Rondo', 'Sedona', 'Seltos', 'Sorento', 'Soul', 'Spectra', 'Sportage', 'Stinger', 'Telluride'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'LR2', 'LR3', 'LR4', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['CT', 'ES', 'GS', 'GX', 'HS', 'IS', 'LC', 'LFA', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'SC', 'TX', 'UX'],
  Lincoln: ['Aviator', 'Continental', 'Corsair', 'LS', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Nautilus', 'Navigator', 'Town Car', 'Zephyr'],
  Lucid: ['Air'],
  Mazda: ['CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-7', 'CX-9', 'CX-90', 'Mazda2', 'Mazda3', 'Mazda5', 'Mazda6', 'MX-5 Miata', 'RX-8', 'Tribute'],
  'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'CLA', 'CLK', 'CLS', 'E-Class', 'G-Class', 'GL-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'M-Class', 'S-Class', 'SL', 'SLC', 'SLK', 'SLS AMG', 'Sprinter'],
  Mercury: ['Grand Marquis', 'Mariner', 'Milan', 'Montego', 'Monterey', 'Mountaineer', 'Sable'],
  Mini: ['Clubman', 'Convertible', 'Cooper', 'Countryman', 'Hardtop', 'Paceman'],
  Mitsubishi: ['Diamante', 'Eclipse', 'Eclipse Cross', 'Endeavor', 'Galant', 'Lancer', 'Mirage', 'Montero', 'Outlander', 'Outlander Sport', 'Raider'],
  Nissan: ['350Z', '370Z', 'Altima', 'Armada', 'Cube', 'Frontier', 'GT-R', 'Juke', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'NV', 'Pathfinder', 'Quest', 'Rogue', 'Rogue Sport', 'Sentra', 'Titan', 'Versa', 'Xterra', 'Z'],
  Polestar: ['1', '2', '3', '4'],
  Pontiac: ['Bonneville', 'Firebird', 'G5', 'G6', 'G8', 'Grand Am', 'Grand Prix', 'GTO', 'Montana', 'Solstice', 'Sunfire', 'Torrent', 'Vibe'],
  Porsche: ['718 Boxster', '718 Cayman', '911', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  Ram: ['1500', '2500', '3500', '4500', '5500', 'ProMaster', 'ProMaster City'],
  Rivian: ['R1S', 'R1T'],
  Saturn: ['Aura', 'Ion', 'L-Series', 'Outlook', 'Relay', 'S-Series', 'Sky', 'Vue'],
  Scion: ['FR-S', 'iA', 'iM', 'iQ', 'tC', 'xA', 'xB', 'xD'],
  Subaru: ['Ascent', 'Baja', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'Tribeca', 'WRX', 'XV Crosstrek'],
  Tesla: ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
  Toyota: ['4Runner', '86', 'Avalon', 'bZ4X', 'C-HR', 'Camry', 'Celica', 'Corolla', 'Corolla Cross', 'Crown', 'Echo', 'FJ Cruiser', 'GR Corolla', 'GR Supra', 'Highlander', 'Land Cruiser', 'Matrix', 'Mirai', 'Prius', 'Prius c', 'Prius Prime', 'Prius v', 'RAV4', 'Sequoia', 'Sienna', 'Solara', 'Supra', 'Tacoma', 'Tundra', 'Venza', 'Yaris'],
  Volkswagen: ['Arteon', 'Atlas', 'Atlas Cross Sport', 'Beetle', 'CC', 'Eos', 'Golf', 'Golf GTI', 'Golf R', 'ID.4', 'Jetta', 'Passat', 'Phaeton', 'Rabbit', 'Routan', 'Taos', 'Tiguan', 'Touareg'],
  Volvo: ['C30', 'C70', 'S40', 'S60', 'S80', 'S90', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90']
};
let vehicleMakeLookupTimer;
let vehicleModelLookupId = 0;
let lastVehicleMakeValue = '';

function populateDatalist(datalist, values) {
  if (!datalist) return;
  datalist.replaceChildren(
    ...[...new Set(values.filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => {
        const option = document.createElement('option');
        option.value = value;
        return option;
      })
  );
}

function loadVehicleMakes() {
  if (!vehicleMakes) return;
  populateDatalist(vehicleMakes, vehicleMakeList);
}

function findExactVehicleMake(make) {
  return vehicleMakeList.find((vehicleMake) => vehicleMake.toLowerCase() === make.trim().toLowerCase());
}

function getAllowedModelsForMake(make) {
  const exactMake = findExactVehicleMake(make);
  return exactMake ? vehicleModelMap[exactMake] || [] : [];
}

function isModelAllowedForMake(make, model) {
  const allowedModels = getAllowedModelsForMake(make);
  if (!allowedModels.length || !model.trim()) return true;
  return allowedModels.some((allowedModel) => allowedModel.toLowerCase() === model.trim().toLowerCase());
}

function validateVehicleSelection() {
  if (!vehicleMakeInput || !vehicleModelInput) return true;
  const make = vehicleMakeInput.value.trim();
  const model = vehicleModelInput.value.trim();
  const exactMake = findExactVehicleMake(make);
  const isValid = isModelAllowedForMake(make, model);

  vehicleModelInput.setCustomValidity('');
  if (exactMake && model && !isValid) {
    vehicleModelInput.setCustomValidity(`${model} is not listed as a ${exactMake} model. Please choose a ${exactMake} model.`);
    return false;
  }

  return true;
}

async function loadVehicleModels(make) {
  const lookupId = ++vehicleModelLookupId;
  const selectedMake = make.trim();
  if (!vehicleModels || !make.trim()) {
    populateDatalist(vehicleModels, []);
    return;
  }

  populateDatalist(vehicleModels, []);

  const exactMake = findExactVehicleMake(selectedMake);
  if (exactMake && vehicleModelMap[exactMake]) {
    populateDatalist(vehicleModels, vehicleModelMap[exactMake]);
    if (vehicleModelInput?.value && !isModelAllowedForMake(exactMake, vehicleModelInput.value)) {
      vehicleModelInput.value = '';
    }
    validateVehicleSelection();
    return;
  }

  try {
    const response = await fetch(`${vehicleApiBase}/GetModelsForMake/${encodeURIComponent(selectedMake)}?format=json`);
    if (!response.ok) throw new Error('Vehicle model lookup failed.');
    const data = await response.json();
    if (lookupId !== vehicleModelLookupId || vehicleMakeInput?.value.trim() !== selectedMake) return;
    populateDatalist(vehicleModels, data.Results.map((model) => model.Model_Name));
    validateVehicleSelection();
  } catch (error) {
    if (lookupId !== vehicleModelLookupId) return;
    populateDatalist(vehicleModels, []);
  }
}

if (vehicleMakeInput && vehicleMakes) {
  loadVehicleMakes();
  vehicleMakeInput.addEventListener('focus', loadVehicleMakes);
  vehicleMakeInput.addEventListener('input', () => {
    const nextMakeValue = vehicleMakeInput.value.trim();
    if (vehicleModelInput && nextMakeValue !== lastVehicleMakeValue) {
      vehicleModelInput.value = '';
      lastVehicleMakeValue = nextMakeValue;
    }
    clearTimeout(vehicleMakeLookupTimer);
    vehicleMakeLookupTimer = setTimeout(() => {
      loadVehicleModels(vehicleMakeInput.value);
    }, 350);
  });
  vehicleMakeInput.addEventListener('change', () => {
    const nextMakeValue = vehicleMakeInput.value.trim();
    if (vehicleModelInput && nextMakeValue !== lastVehicleMakeValue) {
      vehicleModelInput.value = '';
      lastVehicleMakeValue = nextMakeValue;
    }
    loadVehicleModels(vehicleMakeInput.value);
  });
}

if (vehicleModelInput && vehicleMakeInput) {
  vehicleModelInput.addEventListener('focus', () => {
    loadVehicleModels(vehicleMakeInput.value);
  });
  vehicleModelInput.addEventListener('input', validateVehicleSelection);
  vehicleModelInput.addEventListener('change', () => {
    if (!validateVehicleSelection()) {
      vehicleModelInput.reportValidity();
      vehicleModelInput.value = '';
      vehicleModelInput.setCustomValidity('');
    }
  });
}

const addressInput = document.querySelector('[data-address-autocomplete]');
const addressSuggestions = document.querySelector('[data-address-suggestions]');
let addressLookupTimer;
let addressLookupController;

function buildAddressQuery(value) {
  const cleaned = value.trim();
  if (!cleaned) return '';
  return /illinois|\bil\b/i.test(cleaned) ? cleaned : `${cleaned}, Illinois`;
}

function hideAddressSuggestions() {
  if (!addressSuggestions) return;
  addressSuggestions.hidden = true;
  addressSuggestions.replaceChildren();
}

function showAddressSuggestions(addresses) {
  if (!addressSuggestions) return;
  const normalized = addresses
    .map((address) => (typeof address === 'string' ? { label: address } : address))
    .filter((address) => address?.label);
  const seen = new Set();
  const uniqueAddresses = normalized.filter((address) => {
    if (seen.has(address.label)) return false;
    seen.add(address.label);
    return true;
  }).slice(0, 6);

  if (!uniqueAddresses.length) {
    hideAddressSuggestions();
    return;
  }

  addressSuggestions.replaceChildren(
    ...uniqueAddresses.map((address) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'address-suggestion';
      button.textContent = address.label;
      button.addEventListener('click', async () => {
        addressInput.value = address.label;
        hideAddressSuggestions();
        if (!address.placeId) return;
        try {
          const params = new URLSearchParams({ placeId: address.placeId });
          const response = await fetch(`/api/maps/place-details?${params}`, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const details = await response.json();
          if (details.address) addressInput.value = details.address;
          if (Number.isFinite(details.lat) && Number.isFinite(details.lng)) {
            addressInput.dataset.coordinates = `${details.lat}, ${details.lng}`;
            const latField = document.querySelector('[data-location-lat]');
            const lngField = document.querySelector('[data-location-lng]');
            if (latField) latField.value = details.lat;
            if (lngField) lngField.value = details.lng;
          }
        } catch (error) {
          // Keep the typed address if coordinate lookup is unavailable.
        }
      });
      return button;
    })
  );
  addressSuggestions.hidden = false;
}

async function lookupArcgisAddresses(query, signal) {
  const params = new URLSearchParams({
    input: buildAddressQuery(query)
  });
  const response = await fetch(`/api/maps/autocomplete?${params}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.predictions || []).map((prediction) => ({
    label: prediction.description,
    placeId: prediction.placeId
  }));
}

async function lookupNominatimAddresses(query, signal) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: buildAddressQuery(query),
    countrycodes: 'us',
    limit: '6',
    addressdetails: '1',
    viewbox: '-91.5131,42.5083,-87.0199,36.9701',
    bounded: '1'
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!response.ok) return [];
  const results = await response.json();
  return results.map((result) => ({ label: result.display_name }));
}

if (addressInput && addressSuggestions) {
  addressInput.addEventListener('input', () => {
    const typedAddress = addressInput.value.trim();
    addressInput.dataset.coordinates = '';
    const latField = document.querySelector('[data-location-lat]');
    const lngField = document.querySelector('[data-location-lng]');
    if (latField) latField.value = '';
    if (lngField) lngField.value = '';
    clearTimeout(addressLookupTimer);

    if (addressLookupController) {
      addressLookupController.abort();
    }

    if (typedAddress.length < 3) {
      hideAddressSuggestions();
      return;
    }

    addressLookupTimer = setTimeout(async () => {
      addressLookupController = new AbortController();

      try {
        const addresses = await lookupArcgisAddresses(typedAddress, addressLookupController.signal);
        showAddressSuggestions(addresses);
      } catch (error) {
        if (error.name !== 'AbortError') {
          try {
            const addresses = await lookupNominatimAddresses(typedAddress, addressLookupController.signal);
            showAddressSuggestions(addresses);
          } catch (fallbackError) {
            if (fallbackError.name !== 'AbortError') {
              hideAddressSuggestions();
            }
          }
        }
      }
    }, 350);
  });

  addressInput.addEventListener('blur', () => {
    setTimeout(hideAddressSuggestions, 180);
  });
}

const requestStorageKey = 'problemSolversServiceRequests';
const dispatchLocationStorageKey = 'problemSolversDispatchLocation';
const futureExpansionConfig = {
  supportsMultipleTechnicians: false,
  supportsMandatoryOnlinePayments: false,
  supportsLiveTechnicianTracking: false,
  supportsCustomerAccounts: false,
  supportsServiceHistory: false,
  googleMapsApiKey: ''
};
const quoteConfig = {
  includedMiles: 10,
  travelFeePerExtraMile: 2,
  dispatchBufferMinutes: 0,
  maxTravelTimeMinutes: 60,
  longDistanceFee: 50,
  standardTravelTimeMaxMinutes: 60,
  tierOneTravelTimeMaxMinutes: 90,
  tierOneTravelFeePercent: 50,
  tierTwoTravelTimeMaxMinutes: 120,
  tierTwoTravelFeePercent: 100
};
Object.assign(quoteConfig, window.problemSolversQuoteConfig || {});
const servicePricing = {
  'Tire Change': 70,
  'Jump Start': 60,
  'Fuel Delivery': 60,
  'Lockout Service': 65,
  'Tire Inflation': 35,
  'Battery Replacement': 75,
  'Battery Testing': 35,
  'Car Diagnostic Scanner': 50,
  'Light Roadside Repairs': 75
};
const serviceDetailsConfig = {
  'Tire Change': {
    icon: '◎',
    copy: 'Flat tire swap with your spare at your location.',
    questions: [
      { key: 'location', label: 'Is your vehicle currently on the roadside?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'spareTire', label: 'Do you have a spare tire?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'wheelLocks', label: 'Does your vehicle have a locking wheel nut?', type: 'radio', options: ['Yes', 'No'] },
    ]
  },
  'Jump Start': {
    icon: '⚡',
    copy: 'Battery boost at your location.',
    questions: [
      { key: 'location', label: 'Is your vehicle currently on the roadside?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'batteryAgeKnown', label: 'Do you know the battery age?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'hybridElectric', label: 'Is the vehicle hybrid or electric?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'batteryReplacement', label: 'If our technician determines that your battery needs to be replaced, would you like us to replace it?', type: 'radio', options: ['Yes', 'No', 'Not sure'] }
    ]
  },
  'Fuel Delivery': {
    icon: '⛽',
    copy: 'Emergency fuel brought to you.',
    questions: [
      { key: 'location', label: 'Is your vehicle currently on the roadside?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'fuelType', label: 'What fuel do you need?', type: 'radio', options: ['Gas', 'Diesel'] },
      { key: 'gallons', label: 'How many gallons should we bring?', type: 'select', options: ['1 gallon', '2 gallons'] },
    ]
  },
  'Lockout Service': {
    icon: '▣',
    copy: 'Help getting back into your vehicle.',
    questions: [
      { key: 'location', label: 'Is your vehicle currently on the roadside?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'keysVisible', label: 'Are the keys visible inside?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'vehicleRunning', label: 'Is the vehicle running?', type: 'radio', options: ['Yes', 'No'] },
    ]
  },
  'Tire Inflation': {
    icon: '✚',
    copy: 'Low tire pressure support at your location.',
    questions: [
      { key: 'whichTires', label: 'Which tire needs air?', type: 'select', options: ['Front driver', 'Front passenger', 'Rear driver', 'Rear passenger', 'Multiple tires'] },
      { key: 'visiblePuncture', label: 'Do you see a nail, puncture, or leak?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'safeLocation', label: 'Are you parked in a safe location?', type: 'radio', options: ['Yes', 'No'] }
    ]
  },
  'Battery Replacement': {
    icon: '▣',
    copy: 'Battery replacement labor at your location.',
    questions: [
      { key: 'batteryAccessible', label: 'Is the battery easy to access?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
            { key: 'location', label: 'Is your vehicle currently on the roadside?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'needBatterySupplied', label: 'Do you need us to supply the battery?', type: 'radio', options: ['Yes', 'No'] }
    ]
  },
  'Battery Testing': {
    icon: '▤',
    copy: 'Battery health testing with a meter.',
    questions: [
      { key: 'startsSometimes', label: 'Does the vehicle start sometimes?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'warningLights', label: 'Are any warning lights on?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'batteryAgeKnown', label: 'Do you know the battery age?', type: 'radio', options: ['Yes', 'No'] }
    ]
  },
  'Car Diagnostic Scanner': {
    icon: '⚙',
    copy: 'Scanner check for warning lights and codes.',
    questions: [
      { key: 'checkEngineLight', label: 'Is the check engine light on?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'driveabilityIssue', label: 'Is the vehicle shaking, stalling, or losing power?', type: 'radio', options: ['Yes', 'No'] },
      { key: 'vehicleStarts', label: 'Does the vehicle start?', type: 'radio', options: ['Yes', 'No'] }
    ]
  },
  'Light Roadside Repairs': {
    icon: '✦',
    copy: 'Minor roadside repair help when possible.',
    questions: [
      { key: 'repairNeeded', label: 'What repair do you need?', type: 'text', placeholder: 'Briefly describe the repair' },
      { key: 'partsAvailable', label: 'Do you already have the part?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { key: 'safeLocation', label: 'Are you parked in a safe location?', type: 'radio', options: ['Yes', 'No'] }
    ]
  }
};
const tireChangeNoSpareMessage = 'A tire change requires that you already have a usable spare tire. Unfortunately, we cannot complete this service without one. Please contact a towing company or another provider if you do not have a spare tire available.';
const demoRequests = [
  {
    id: 'demo-1',
    customerName: 'Avery Johnson',
    phone: '312-555-0184',
    email: 'avery@example.com',
    vehicleYear: '2018',
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    vehicleColor: 'Gray',
    problem: 'Tire Change',
    currentLocation: '100 Main, Greenfield, IL, 62044, USA',
    message: 'Front passenger tire is flat. Parked near the entrance.',
    preferredPaymentMethod: 'Card',
    status: 'Pending',
    paymentStatus: 'Payment Pending',
    distanceMiles: 18,
    travelTimeMinutes: 32,
    basePrice: 70,
    travelFee: 15,
    totalPrice: 85,
    referenceNumber: 'PS-1001',
    internalNotes: '',
    photos: ['flat-tire-photo.jpg'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-2',
    customerName: 'Morgan Lee',
    phone: '708-555-0109',
    email: '',
    vehicleYear: '2020',
    vehicleMake: 'Honda',
    vehicleModel: 'Accord',
    vehicleColor: 'Black',
    problem: 'Jump Start',
    currentLocation: 'Oak Park, IL, USA',
    message: 'Battery died after lights were left on.',
    preferredPaymentMethod: 'Card',
    status: 'Accepted',
    paymentStatus: 'Payment Pending',
    distanceMiles: 12,
    travelTimeMinutes: 24,
    basePrice: 60,
    travelFee: 10,
    totalPrice: 70,
    referenceNumber: 'PS-1002',
    internalNotes: 'Call before arrival.',
    photos: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 46).toISOString()
  }
];

function getStoredRequests() {
  try {
    const requests = JSON.parse(localStorage.getItem(requestStorageKey) || '[]');
    return Array.isArray(requests) ? requests : [];
  } catch (error) {
    return [];
  }
}

function saveStoredRequests(requests) {
  localStorage.setItem(requestStorageKey, JSON.stringify(requests));
}

function seedDemoRequests() {
  const existing = getStoredRequests();
  const missingDemo = demoRequests.filter((demo) => !existing.some((request) => request.id === demo.id));
  saveStoredRequests([...missingDemo, ...existing]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function mapLink(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || '')}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function requestMatches(request, search, status) {
  const haystack = [
    request.customerName,
    request.phone,
    request.vehicleYear,
    request.vehicleMake,
    request.vehicleModel,
    request.vehicleColor,
    request.problem,
    request.currentLocation,
    request.status,
    request.referenceNumber,
    request.paymentStatus
  ].join(' ').toLowerCase();

  return (!status || request.status === status) && (!search || haystack.includes(search.toLowerCase()));
}

function requestCardHtml(request, compact = false) {
  const vehicle = [request.vehicleYear, request.vehicleColor, request.vehicleMake, request.vehicleModel].filter(Boolean).join(' ');
  const photoList = [...(request.photoPaths || []), ...(request.photos || [])];
  const photoHtml = photoList.length
    ? `<div class="dashboard-photo-list">${photoList.map((photo) => {
      const source = String(photo).startsWith('/') ? photo : `/uploads/${photo}`;
      return `<a href="${escapeHtml(source)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(source)}" alt="Customer uploaded service photo"></a>`;
    }).join('')}</div>`
    : 'No photos';
  const serviceDetails = formatServiceDetails(request.serviceDetails);
  const mapDestination = request.location?.lat && request.location?.lng
    ? `${request.location.lat},${request.location.lng}`
    : request.currentLocation;
  return `
    <article class="manager-request-card" data-request-id="${escapeHtml(request.id)}">
      <div class="request-card-head">
        <div>
          <span class="status-pill manager-status">${escapeHtml(request.status || 'New')}</span>
          <h3>${escapeHtml(request.problem || 'Roadside Request')}</h3>
          <p>${escapeHtml(request.requestId || request.referenceNumber || 'Request ID pending')}</p>
        </div>
        <time>${escapeHtml(formatDate(request.createdAt || new Date().toISOString()))}</time>
      </div>
      <div class="request-card-grid">
        <p><span>Customer</span><strong>${escapeHtml(request.customerName || 'Customer')}</strong></p>
        <p><span>Phone</span><strong>${escapeHtml(request.phone || 'No phone')}</strong></p>
        <p><span>Vehicle</span><strong>${escapeHtml(vehicle || 'Vehicle not listed')}</strong></p>
        <p><span>Payment</span><strong>${escapeHtml(request.preferredPaymentMethod || 'Not selected')}</strong></p>
        <p><span>Payment Status</span><strong>${escapeHtml(request.paymentStatus || 'Payment Pending')}</strong></p>
        <p><span>Distance</span><strong>${escapeHtml(request.distanceMiles ? `${request.distanceMiles} miles` : 'Not estimated')}</strong></p>
        <p><span>Drive Time</span><strong>${escapeHtml(request.travelTimeMinutes ? `${request.travelTimeMinutes} min` : 'Not estimated')}</strong></p>
        <p><span>ETA</span><strong>${escapeHtml(request.estimatedArrivalMinutes ? `${request.estimatedArrivalMinutes} min` : 'Not estimated')}</strong></p>
        <p><span>Total Quote</span><strong>${escapeHtml(request.totalPrice ? `$${request.totalPrice}` : 'Not quoted')}</strong></p>
      </div>
      <p class="request-location"><span>Location</span><strong>${escapeHtml(request.currentLocation || 'No location')}</strong></p>
      ${compact ? '' : `<p class="request-message">${escapeHtml(request.message || 'No extra message.')}</p>`}
      ${compact || !serviceDetails ? '' : `<p class="request-message"><span>Service details</span><br>${serviceDetails}</p>`}
      ${compact ? '' : `<div class="request-photo"><span>Photos</span> ${photoHtml}</div>`}
      <div class="request-actions">
        <a class="btn primary" href="tel:${escapeHtml(request.phone || '')}">Call</a>
        <a class="btn secondary" href="sms:${escapeHtml(request.phone || '')}">Text</a>
        <a class="btn ghost" target="_blank" rel="noreferrer" href="${escapeHtml(mapLink(mapDestination))}">Open Map</a>
        <a class="btn ghost" target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapDestination || '')}">Navigate</a>
      </div>
      ${compact ? '' : `
        <div class="manager-update-row">
          <select data-status-update>
            ${['Pending', 'Accepted', 'Technician Assigned', 'En Route', 'Arrived', 'Completed', 'Cancelled'].map((status) => `<option ${request.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <select data-payment-status-update>
            ${['Payment Pending', 'Paid'].map((status) => `<option ${request.paymentStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <input data-manager-note value="${escapeHtml(request.internalNotes || request.note || '')}" placeholder="Internal manager note">
        </div>
      `}
    </article>
  `;
}

function formatServiceDetails(details) {
  if (!details) return '';
  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch (error) {
      return escapeHtml(details);
    }
  }
  if (!parsed || typeof parsed !== 'object') return '';

  return Object.entries(parsed)
    .filter(([, value]) => value)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
      return `${escapeHtml(label)}: ${escapeHtml(value)}`;
    })
    .join('<br>');
}

function renderManagerRequests() {
  const list = document.querySelector('[data-manager-requests]');
  if (!list) return;

  const search = document.querySelector('[data-request-search]')?.value || '';
  const status = document.querySelector('[data-request-filter]')?.value || '';
  const requests = getStoredRequests();
  const visibleRequests = requests.filter((request) => requestMatches(request, search, status));

  list.innerHTML = visibleRequests.length
    ? visibleRequests.map((request) => requestCardHtml(request)).join('')
    : '<div class="empty-state"><h3>No requests yet</h3><p>Submit the request form or load demo jobs to preview the manager queue.</p></div>';
}

function renderRecentRequests() {
  const list = document.querySelector('[data-manager-recent]');
  if (!list) return;

  const requests = getStoredRequests();
  list.innerHTML = requests.length
    ? requests.slice(0, 3).map((request) => requestCardHtml(request, true)).join('')
    : '<div class="empty-state"><h3>No recent requests</h3><p>Requests submitted from the preview form will show here.</p></div>';
}

function renderDashboardStats() {
  const statsRoot = document.querySelector('[data-dashboard-stats]');
  if (!statsRoot) return;

  const requests = getStoredRequests();
  statsRoot.querySelectorAll('[data-stat]').forEach((stat) => {
    stat.textContent = requests.filter((request) => request.status === stat.dataset.stat).length;
  });
}

function setupManagerDashboard() {
  if (document.querySelector('[data-manager-requests]') || document.querySelector('[data-manager-recent]')) {
    if (!getStoredRequests().length) seedDemoRequests();
    renderManagerRequests();
    renderRecentRequests();
    renderDashboardStats();
  }

  document.querySelector('[data-request-search]')?.addEventListener('input', renderManagerRequests);
  document.querySelector('[data-request-filter]')?.addEventListener('change', renderManagerRequests);

  document.querySelector('[data-seed-demo]')?.addEventListener('click', () => {
    seedDemoRequests();
    renderManagerRequests();
  });

  document.querySelector('[data-clear-demo]')?.addEventListener('click', () => {
    saveStoredRequests([]);
    renderManagerRequests();
  });

  document.querySelector('[data-manager-requests]')?.addEventListener('change', (event) => {
    const card = event.target.closest('[data-request-id]');
    if (!card) return;

    const requests = getStoredRequests();
    const request = requests.find((item) => item.id === card.dataset.requestId);
    if (!request) return;

    if (event.target.matches('[data-status-update]')) {
      request.status = event.target.value;
    }
    if (event.target.matches('[data-payment-status-update]')) {
      request.paymentStatus = event.target.value;
    }
    if (event.target.matches('[data-manager-note]')) {
      request.internalNotes = event.target.value;
    }

    saveStoredRequests(requests);
    renderManagerRequests();
  });
}

let latestQuote;

function money(value) {
  return `$${Math.round(value)}`;
}

function buildBaseQuote(problem) {
  const basePrice = servicePricing[problem] || 75;

  return {
    basePrice,
    travelFee: 0,
    totalPrice: basePrice,
    distanceMiles: null,
    travelTimeMinutes: null,
    estimatedArrivalMinutes: null,
    travelEstimateStatus: 'needs-location',
    referenceNumber: `PS-${Date.now().toString().slice(-6)}`
  };
}

function parseCoordinates(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  return match ? { lat: Number(match[1]), lng: Number(match[2]) } : null;
}

function getDispatchCenter() {
  if (window.problemSolversDispatchCenter) return window.problemSolversDispatchCenter;

  try {
    const stored = JSON.parse(localStorage.getItem(dispatchLocationStorageKey) || 'null');
    if (stored && Number.isFinite(stored.lat) && Number.isFinite(stored.lng)) return stored;
  } catch (error) {
    return null;
  }

  return null;
}

function formatCoordinateLocation(location) {
  if (!location) return 'Starting point not set';
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function setupDispatchLocationTool() {
  const button = document.querySelector('[data-set-dispatch-location]');
  const status = document.querySelector('[data-dispatch-location-status]');
  if (!button || !status) return;

  status.textContent = formatCoordinateLocation(getDispatchCenter());

  button.addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = 'Location is not available in this browser.';
      return;
    }

    status.textContent = 'Getting your current location...';
    navigator.geolocation.getCurrentPosition((position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(dispatchLocationStorageKey, JSON.stringify(location));
      const latInput = document.querySelector('[data-dispatch-lat]');
      const lngInput = document.querySelector('[data-dispatch-lng]');
      if (latInput) latInput.value = location.lat;
      if (lngInput) lngInput.value = location.lng;
      status.textContent = `Starting point added: ${formatCoordinateLocation(location)}. Click Save Settings to keep it.`;
    }, () => {
      status.textContent = 'Could not get your location. Allow location access and try again.';
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    });
  });
}

function setupLiveLocationTool() {
  const panel = document.querySelector('[data-live-location-panel]');
  if (!panel) return;

  const startButton = panel.querySelector('[data-live-location-start]');
  const stopButton = panel.querySelector('[data-live-location-stop]');
  const statusText = panel.querySelector('[data-live-location-status]');
  const onlineText = panel.querySelector('[data-live-location-online]');
  const currentText = panel.querySelector('[data-live-location-current]');
  const updatedText = panel.querySelector('[data-live-location-updated]');
  const liveLocationEndpoint = panel.dataset.liveLocationEndpoint || '/dashboard/live-location';
  let watchId = null;
  let lastSaveAt = 0;

  const setStatus = (message) => {
    if (statusText) statusText.textContent = message;
  };

  const setOnlineState = (isOnline) => {
    if (onlineText) onlineText.textContent = isOnline ? 'Online' : 'Offline';
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = !isOnline && watchId === null;
  };

  async function postLiveLocation(payload) {
    const csrfToken = await getCsrfToken();
    const response = await fetch(liveLocationEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Could not save live location.');
    return response.json();
  }

  async function saveLiveLocation(position, force = false) {
    const now = Date.now();
    if (!force && now - lastSaveAt < 25000) return;
    lastSaveAt = now;

    const payload = {
      online: true,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    await postLiveLocation(payload);
    if (currentText) currentText.textContent = `${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)}`;
    if (updatedText) updatedText.textContent = new Date().toLocaleString();
    setOnlineState(true);
    setStatus('Live location is active.');
  }

  function startSharing() {
    if (!navigator.geolocation) {
      setStatus('Location is not available in this browser.');
      return;
    }

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    setStatus('Requesting location permission...');
    if (startButton) startButton.disabled = true;
    lastSaveAt = 0;
    navigator.geolocation.getCurrentPosition((position) => {
      saveLiveLocation(position, true).catch((error) => {
        setOnlineState(false);
        setStatus(error.message || 'Could not save live location.');
      });
    }, () => {
      setOnlineState(false);
      setStatus('Could not get your location. Allow location access and try again.');
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });

    watchId = navigator.geolocation.watchPosition((position) => {
      saveLiveLocation(position).catch((error) => {
        setStatus(error.message || 'Could not save live location.');
      });
    }, () => {
      setOnlineState(false);
      setStatus('Could not get your location. Allow location access and try again.');
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    });
  }

  async function stopSharing() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    try {
      await postLiveLocation({ online: false });
      setOnlineState(false);
      setStatus('You are offline. Customer quotes will not use this device as an online technician.');
    } catch (error) {
      setOnlineState(false);
      setStatus(error.message || 'Live sharing stopped on this device, but the server could not be updated.');
    }
  }

  setOnlineState(panel.dataset.liveLocationInitialOnline === 'true');
  startButton?.addEventListener('click', startSharing);
  stopButton?.addEventListener('click', stopSharing);
}

function distanceMilesBetween(start, end) {
  const radius = 3958.8;
  const toRad = (degree) => degree * Math.PI / 180;
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function estimateWithGoogleMaps(origin, destination) {
  if (!destination) return null;

  const params = new URLSearchParams({
    destinationLat: destination.lat,
    destinationLng: destination.lng
  });
  const response = await fetch(`/api/maps/distance?${params}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const estimate = await response.json();
  if (!Number.isFinite(estimate.distanceMiles) || !Number.isFinite(estimate.travelTimeMinutes)) return null;
  return estimate;
}

async function estimateWithOpenRoute(origin, destination) {
  if (!origin || !destination) return null;

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`);
  if (!response.ok) return null;

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    distanceMiles: Math.max(1, Math.round(route.distance / 1609.344)),
    travelTimeMinutes: Math.max(5, Math.round(route.duration / 60))
  };
}

async function geocodeLocation(location) {
  const coordinates = parseCoordinates(location);
  if (coordinates) return coordinates;

  try {
    const params = new URLSearchParams({ address: buildAddressQuery(location) });
    const response = await fetch(`/api/maps/geocode?${params}`, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      if (Number.isFinite(data.lat) && Number.isFinite(data.lng)) {
        const latField = document.querySelector('[data-location-lat]');
        const lngField = document.querySelector('[data-location-lng]');
        if (latField) latField.value = data.lat;
        if (lngField) lngField.value = data.lng;
        if (addressInput && data.address) addressInput.value = data.address;
        return { lat: data.lat, lng: data.lng };
      }
    }
  } catch (error) {
    // Fall through to the no-key development lookup below.
  }

  const params = new URLSearchParams({
    f: 'json',
    singleLine: buildAddressQuery(location),
    outFields: 'Match_addr',
    maxLocations: '1',
    searchExtent: '-91.5131,36.9701,-87.0199,42.5083'
  });
  const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`);
  if (!response.ok) return null;
  const data = await response.json();
  const candidate = data.candidates?.[0];
  return candidate?.location ? { lat: candidate.location.y, lng: candidate.location.x } : null;
}

async function calculateQuote(form) {
  const data = new FormData(form);
  const problem = data.get('problem');
  const basePrice = servicePricing[problem] || 75;
  const dispatchCenter = getDispatchCenter();
  const locationInput = form.querySelector('input[name="currentLocation"]');
  const destination = parseCoordinates(locationInput?.dataset.coordinates) || await geocodeLocation(data.get('currentLocation'));
  const googleEstimate = await estimateWithGoogleMaps(dispatchCenter, destination);
  let distanceMiles = googleEstimate?.distanceMiles;
  let travelTimeMinutes = googleEstimate?.travelTimeMinutes;
  let travelEstimateSource = googleEstimate?.originSource || null;

  if (!googleEstimate && dispatchCenter && destination) {
    const routeEstimate = await estimateWithOpenRoute(dispatchCenter, destination);

    if (routeEstimate) {
      distanceMiles = routeEstimate.distanceMiles;
      travelTimeMinutes = routeEstimate.travelTimeMinutes;
      travelEstimateSource = 'browser-route-fallback';
    } else {
      const straightLineMiles = distanceMilesBetween(dispatchCenter, destination);
      distanceMiles = Math.max(1, Math.round(straightLineMiles * 1.25));
      travelTimeMinutes = Math.max(10, Math.round(distanceMiles * 1.9));
      travelEstimateSource = 'browser-distance-fallback';
    }
  }

  const hasTravelEstimate = Number.isFinite(distanceMiles) && Number.isFinite(travelTimeMinutes);
  const standardTravelTimeMaxMinutes = Number(quoteConfig.standardTravelTimeMaxMinutes ?? quoteConfig.maxTravelTimeMinutes ?? 60);
  const tierOneTravelTimeMaxMinutes = Number(quoteConfig.tierOneTravelTimeMaxMinutes ?? 90);
  const tierOneTravelFeePercent = Number(quoteConfig.tierOneTravelFeePercent ?? 50);
  const tierTwoTravelTimeMaxMinutes = Number(quoteConfig.tierTwoTravelTimeMaxMinutes ?? 120);
  const tierTwoTravelFeePercent = Number(quoteConfig.tierTwoTravelFeePercent ?? 100);
  let travelFeePercent = 0;
  let longDistanceTier = '';
  let longDistanceThresholdMinutes = standardTravelTimeMaxMinutes;

  if (hasTravelEstimate && travelTimeMinutes > standardTravelTimeMaxMinutes) {
    if (travelTimeMinutes <= tierOneTravelTimeMaxMinutes) {
      travelFeePercent = tierOneTravelFeePercent;
      longDistanceTier = 'tier-one';
      longDistanceThresholdMinutes = standardTravelTimeMaxMinutes;
    } else {
      travelFeePercent = tierTwoTravelFeePercent;
      longDistanceTier = 'tier-two';
      longDistanceThresholdMinutes = tierOneTravelTimeMaxMinutes;
    }
  }

  const longDistanceApplies = travelFeePercent > 0;
  const travelFee = longDistanceApplies ? Math.ceil(basePrice * (travelFeePercent / 100)) : 0;
  const totalPrice = basePrice + travelFee;

  return {
    basePrice,
    travelFee,
    totalPrice,
    distanceMiles: hasTravelEstimate ? distanceMiles : null,
    travelTimeMinutes: hasTravelEstimate ? travelTimeMinutes : null,
    estimatedArrivalMinutes: hasTravelEstimate ? travelTimeMinutes + Number(quoteConfig.dispatchBufferMinutes || 0) : null,
    travelEstimateStatus: hasTravelEstimate ? 'estimated' : 'needs-confirmation',
    travelEstimateSource: hasTravelEstimate ? travelEstimateSource : '',
    longDistanceApplies,
    maxTravelTimeMinutes: standardTravelTimeMaxMinutes,
    longDistanceTier,
    travelFeePercent,
    longDistanceThresholdMinutes,
    tierTwoTravelTimeMaxMinutes,
    referenceNumber: `PS-${Date.now().toString().slice(-6)}`
  };
}

function renderQuote(quote) {
  const quotePanel = document.querySelector('[data-quote-panel]');
  const submitButton = document.querySelector('[data-submit-request]');
  if (!quotePanel) return;

  document.querySelector('[data-quote-total]').textContent = money(quote.totalPrice);
  const baseElement = document.querySelector('[data-quote-base]');
  const feeRow = document.querySelector('[data-quote-long-distance]');
  const feeElement = document.querySelector('[data-quote-long-distance-fee]');
  const feeMessage = document.querySelector('[data-quote-long-distance-message]');
  if (baseElement) baseElement.textContent = money(quote.basePrice);
  if (feeElement) feeElement.textContent = money(quote.travelFee || 0);
  if (feeRow) feeRow.hidden = !quote.longDistanceApplies;
  if (feeMessage) {
    feeMessage.hidden = !quote.longDistanceApplies;
    feeMessage.textContent = quote.longDistanceApplies
      ? `An additional ${quote.travelFeePercent}% travel fee has been applied because the estimated driving time is more than ${quote.longDistanceThresholdMinutes} minutes.`
      : '';
  }
  quotePanel.hidden = false;
  if (submitButton) submitButton.textContent = 'Pay Now';
  Object.entries(quote).forEach(([key, value]) => {
    const field = document.querySelector(`[data-quote-field="${key}"]`);
    if (field) field.value = value ?? '';
  });
}

function questionFieldName(question) {
  return `serviceDetail_${question.key}`;
}

function renderQuestion(question, serviceName, index) {
  const fieldName = questionFieldName(question);
  const id = `${fieldName}_${index}`;

  if (question.type === 'radio') {
    return `
      <fieldset class="service-question" data-service-question-group="${escapeHtml(question.key)}">
        <legend>${escapeHtml(question.label)}</legend>
        <div class="choice-row">
          ${question.options.map((option, optionIndex) => `
            <label class="choice-pill">
              <input type="radio" name="${escapeHtml(fieldName)}" value="${escapeHtml(option)}" data-service-question="${escapeHtml(question.key)}" ${optionIndex === 0 ? 'required' : ''}>
              <span>${escapeHtml(option)}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `;
  }

  if (question.type === 'select') {
    return `
      <label class="service-question" for="${escapeHtml(id)}">${escapeHtml(question.label)}
        <select id="${escapeHtml(id)}" name="${escapeHtml(fieldName)}" data-service-question="${escapeHtml(question.key)}" required>
          <option value="">Choose one</option>
          ${question.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}
        </select>
      </label>
    `;
  }

  return `
    <label class="service-question" for="${escapeHtml(id)}">${escapeHtml(question.label)}
      <input id="${escapeHtml(id)}" name="${escapeHtml(fieldName)}" data-service-question="${escapeHtml(question.key)}" placeholder="${escapeHtml(question.placeholder || `Details for ${serviceName}`)}" required>
    </label>
  `;
}

function renderSelectedServiceDetails() {
  if (!problemInput) return;
  const serviceName = problemInput.value;
  const config = serviceDetailsConfig[serviceName];
  const nameText = serviceName || 'Select a service';
  const copyText = config?.copy || 'Choose the service so we can ask the right questions.';
  const iconText = config?.icon || '◎';

  document.querySelectorAll('[data-selected-service-name]').forEach((element) => {
    element.textContent = nameText;
  });
  document.querySelectorAll('[data-selected-service-copy]').forEach((element) => {
    element.textContent = copyText;
  });
  document.querySelectorAll('[data-selected-service-icon]').forEach((element) => {
    element.textContent = iconText;
  });
  document.querySelectorAll('[data-selected-service-readonly]').forEach((element) => {
    element.value = nameText;
  });

  const questionRoot = document.querySelector('[data-service-questions]');
  if (questionRoot) {
    questionRoot.innerHTML = config?.questions?.length
      ? config.questions.map((question, index) => renderQuestion(question, serviceName, index)).join('')
      : '<p class="summary-note">Choose a service to continue.</p>';
  }
}

function collectServiceDetails(form) {
  const details = {};
  form.querySelectorAll('[data-service-question]').forEach((field) => {
    if (field.type === 'radio' && !field.checked) return;
    details[field.dataset.serviceQuestion] = field.value;
  });

  const hiddenField = form.querySelector('[data-service-details-field]');
  if (hiddenField) hiddenField.value = JSON.stringify(details);
  return details;
}

function validateServiceBusinessRules(form, options = {}) {
  const { showMessage = true, lockButton = true } = options;
  const details = collectServiceDetails(form);
  const blocked = problemInput?.value === 'Tire Change' && String(details.spareTire || '').toLowerCase() === 'no';
  const blockMessage = form.querySelector('[data-service-block-message]');
  const detailsStep = form.querySelector('[data-request-step="details"]');
  const detailsNext = detailsStep?.querySelector('[data-step-next]');

  if (blockMessage) {
    blockMessage.textContent = blocked && showMessage ? tireChangeNoSpareMessage : '';
    blockMessage.hidden = !blocked || !showMessage;
  }
  if (detailsNext && (lockButton || !blocked)) {
    detailsNext.disabled = blocked;
    detailsNext.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  }

  return !blocked;
}

function validateStepFields(step) {
  const fields = Array.from(step.querySelectorAll('input, select, textarea'))
    .filter((field) => field.type !== 'hidden' && !field.disabled);
  const invalidField = fields.find((field) => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return false;
  }

  return true;
}

function updateRequestSummary(form) {
  const data = new FormData(form);
  const vehicle = [
    data.get('vehicleYear'),
    data.get('vehicleColor'),
    data.get('vehicleMake'),
    data.get('vehicleModel')
  ].filter(Boolean).join(' ');
  const location = data.get('currentLocation') || 'Location';

  const serviceElement = document.querySelector('[data-summary-service]');
  const vehicleElement = document.querySelector('[data-summary-vehicle]');
  const locationElement = document.querySelector('[data-summary-location]');
  const arrivalElement = document.querySelector('[data-summary-arrival]');

  if (serviceElement) serviceElement.textContent = data.get('problem') || 'Service';
  if (vehicleElement) vehicleElement.textContent = vehicle || 'Vehicle';
  if (locationElement) locationElement.textContent = location;
  if (arrivalElement) {
    arrivalElement.textContent = latestQuote?.estimatedArrivalMinutes
      ? `${latestQuote.estimatedArrivalMinutes} minutes`
      : 'Calculated at review';
  }
}

function showCustomerConfirmation(request) {
  const panel = document.querySelector('[data-confirmation-panel]');
  if (!panel) return;
  document.querySelector('[data-reference-number]').textContent = request.referenceNumber;
  document.querySelector('[data-arrival-time]').textContent = request.estimatedArrivalMinutes
    ? `${request.estimatedArrivalMinutes} minutes`
    : 'Calculated after dispatch';
  document.querySelector('[data-confirm-payment]').textContent = request.preferredPaymentMethod;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validatePhotoUpload(form) {
  const input = form.querySelector('[data-photo-upload]');
  if (!input) return true;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
  const files = Array.from(input.files || []);

  if (files.length > 5) {
    alert('Please upload no more than 5 images.');
    return false;
  }

  const invalidFile = files.find((file) => file.type && !allowedTypes.includes(file.type));
  if (invalidFile) {
    alert('Please upload only JPG, PNG, or HEIC images.');
    return false;
  }

  return true;
}

let csrfTokenPromise;

async function getCsrfToken() {
  csrfTokenPromise ||= fetch('/api/csrf-token', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
    .then((response) => {
      if (!response.ok) throw new Error('Unable to prepare the secure form token.');
      return response.json();
    })
    .then((data) => data.csrfToken);

  return csrfTokenPromise;
}

async function createServiceRequest(form) {
  const csrfToken = await getCsrfToken();
  const response = await fetch('/api/service-requests', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: new FormData(form)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.errors?.map((error) => error.msg).join('\n')
      || payload.error
      || 'Please check the form and try again.';
    throw new Error(message);
  }

  return payload.request;
}

async function startStripeCheckout(request) {
  const csrfToken = await getCsrfToken();
  const response = await fetch('/payments/checkout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      serviceRequestId: request.id,
      amount: request.totalPrice
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Stripe checkout is not ready yet.');
  }
  if (!payload.url) throw new Error('Stripe did not return a checkout page.');

  window.location.href = payload.url;
}

function setupStaticRequestSave() {
  const form = document.querySelector('[data-request-form]');
  if (!form) return;
  const submitButton = document.querySelector('[data-submit-request]');
  const summaryStep = form.querySelector('[data-request-step="summary"]');

  renderSelectedServiceDetails();
  problemInput?.addEventListener('change', () => {
    renderSelectedServiceDetails();
    collectServiceDetails(form);
    validateServiceBusinessRules(form, { showMessage: false, lockButton: false });
  });
  setupRequestSteps(form);
  form.querySelector('[data-service-questions]')?.addEventListener('change', () => {
    validateServiceBusinessRules(form, { showMessage: false, lockButton: false });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (summaryStep?.hidden) {
      form.querySelector('.request-step:not([hidden]) [data-step-next]')?.click();
      return;
    }

    if (!validateVehicleSelection()) {
      vehicleModelInput?.reportValidity();
      return;
    }
    if (!validatePhotoUpload(form)) return;
    collectServiceDetails(form);
    if (!validateServiceBusinessRules(form, { showMessage: false, lockButton: true })) return;

    let savedRequest = null;

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Checking Quote...';
      }
      latestQuote = await calculateQuote(form);
      renderQuote(latestQuote);
      updateRequestSummary(form);

      if (submitButton) submitButton.textContent = 'Preparing Payment...';
      savedRequest = await createServiceRequest(form);

      if (submitButton) submitButton.textContent = 'Opening Payment...';
      await startStripeCheckout(savedRequest);
    } catch (error) {
      if (savedRequest) showCustomerConfirmation(savedRequest);
      if (String(error.message || '').includes('usable spare tire')) return;
      alert(error.message || 'Unable to complete the request. Please try again.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Pay Now';
      }
    }
  });
}

function setupRequestSteps(form) {
  const stepNames = ['service', 'details', 'vehicle', 'contact', 'summary'];
  const steps = stepNames
    .map((name) => form.querySelector(`[data-request-step="${name}"]`))
    .filter(Boolean);
  if (!steps.length) return;

  let currentIndex = Math.max(0, steps.findIndex((step) => !step.hidden));
  if (currentIndex < 0) currentIndex = 0;

  const showStep = (index) => {
    currentIndex = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== currentIndex;
    });

    const currentName = steps[currentIndex].dataset.requestStep;
    document.querySelectorAll('[data-progress-step]').forEach((item) => {
      const itemIndex = stepNames.indexOf(item.dataset.progressStep);
      item.classList.toggle('is-active', itemIndex === currentIndex);
      item.classList.toggle('is-complete', itemIndex >= 0 && itemIndex < currentIndex);
    });
    if (currentName === 'summary') updateRequestSummary(form);
    steps[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const advance = async () => {
    const activeStep = steps[currentIndex];
    const activeName = activeStep.dataset.requestStep;

    if (activeName === 'service') {
      if (!validateStepFields(activeStep)) return;
      renderSelectedServiceDetails();
    }

    if (activeName === 'details') {
      if (!validateStepFields(activeStep)) return;
      collectServiceDetails(form);
      if (!validateServiceBusinessRules(form, { showMessage: true, lockButton: true })) return;
    }

    if (activeName === 'vehicle') {
      if (!validateVehicleSelection()) {
        vehicleModelInput?.reportValidity();
        return;
      }
      if (!validateStepFields(activeStep)) return;
    }

    if (activeName === 'contact') {
      if (!validateStepFields(activeStep) || !validatePhotoUpload(form)) return;
      const nextButton = activeStep.querySelector('[data-step-next]');
      try {
        if (nextButton) {
          nextButton.disabled = true;
          nextButton.textContent = 'Calculating Quote...';
        }
        latestQuote = await calculateQuote(form);
        renderQuote(latestQuote);
        updateRequestSummary(form);
      } catch (error) {
        alert(error.message || 'Unable to calculate the quote. Please try again.');
        return;
      } finally {
        if (nextButton) {
          nextButton.disabled = false;
          nextButton.textContent = 'Review Quote';
        }
      }
    }

    showStep(currentIndex + 1);
  };

  form.querySelectorAll('[data-step-next]').forEach((button) => {
    button.addEventListener('click', () => {
      advance();
    });
  });

  form.querySelectorAll('[data-step-back]').forEach((button) => {
    button.addEventListener('click', () => showStep(currentIndex - 1));
  });

  showStep(currentIndex);
}

setupStaticRequestSave();
setupManagerDashboard();
setupDispatchLocationTool();
setupLiveLocationTool();
