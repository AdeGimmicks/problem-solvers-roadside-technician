const SERVICES = [
  {
    slug: 'tire-change',
    name: 'Tire Change',
    publicRequest: true,
    description: 'On-location spare tire installation for flats, blowouts, and unsafe tires.',
    included: ['Vehicle safety check', 'Spare tire installation', 'Lug nut torque check'],
    when: 'Call when your tire is flat, damaged, or unsafe to drive on.',
    price: '$75'
  },
  {
    slug: 'jump-start',
    name: 'Jump Start',
    publicRequest: true,
    description: 'Fast battery jump starts for cars, SUVs, and light trucks.',
    included: ['Battery connection check', 'Portable jump start', 'Charging system guidance'],
    when: 'Call when your vehicle clicks, lights dim, or the battery is drained.',
    price: '$65'
  },
  {
    slug: 'battery-testing',
    name: 'Battery Testing',
    publicRequest: false,
    description: 'Mobile battery testing to confirm whether you need a jump, charge, or replacement.',
    included: ['Voltage test', 'Load test guidance', 'Replacement recommendation'],
    when: 'Call when starts are slow or you are not sure the battery is healthy.',
    price: '$45'
  },
  {
    slug: 'battery-replacement',
    name: 'Battery Replacement',
    publicRequest: true,
    description: 'Battery replacement at your location when a battery is available for your vehicle.',
    included: ['Battery fitment check', 'Old battery removal', 'New battery installation'],
    when: 'Call when testing confirms a failed battery or repeated no-start issues.',
    price: '$125 plus battery'
  },
  {
    slug: 'lockout',
    name: 'Lockout Service',
    publicRequest: true,
    description: 'Careful vehicle lockout help when your keys are locked inside.',
    included: ['Arrival verification', 'Non-destructive entry tools', 'Door and seal care'],
    when: 'Call when keys are locked in the vehicle and you need mobile assistance.',
    price: '$85'
  },
  {
    slug: 'fuel-delivery',
    name: 'Fuel Delivery',
    publicRequest: true,
    description: 'Emergency fuel delivery so you can safely reach the nearest station.',
    included: ['Fuel pickup', 'Safe delivery', 'Route guidance to nearby gas'],
    when: 'Call when you run out of gas or are too low to continue safely.',
    price: '$75 plus fuel'
  },
  {
    slug: 'tire-inflation',
    name: 'Tire Inflation',
    publicRequest: true,
    description: 'Mobile tire air-up service for low-pressure tires and slow leaks.',
    included: ['Pressure check', 'Air inflation', 'Visible tire inspection'],
    when: 'Call when your tire pressure warning is on or a tire looks low.',
    price: '$50'
  },
  {
    slug: 'light-roadside-repairs',
    name: 'Light Roadside Repairs',
    publicRequest: false,
    description: 'Small roadside repairs that can be completed safely at your location.',
    included: ['Basic diagnosis', 'Minor adjustments', 'Repair recommendation'],
    when: 'Call for simple issues that do not require towing or shop equipment.',
    price: '$95'
  }
];

const REQUEST_STATUSES = [
  'Pending',
  'Accepted',
  'Technician Assigned',
  'En Route',
  'Arrived',
  'Completed',
  'Cancelled'
];

const AUTO_REPAIR_SERVICES = [
  {
    slug: 'brake-pad-replacement',
    name: 'Brake Pad Replacement',
    startingLaborPrice: 200,
    description: 'Mobile brake pad replacement quote request for front, rear, or uncertain brake wear.'
  },
  {
    slug: 'brake-pads-rotor-replacement',
    name: 'Brake Pads & Rotor Replacement',
    startingLaborPrice: 250,
    description: 'Quote request for brake pads and rotor replacement after vehicle and symptom review.'
  },
  {
    slug: 'alternator-replacement',
    name: 'Alternator Replacement',
    startingLaborPrice: 250,
    description: 'Mobile alternator replacement quote request based on vehicle fitment and access.'
  },
  {
    slug: 'starter-replacement',
    name: 'Starter Replacement',
    startingLaborPrice: 250,
    description: 'Starter replacement quote request after no-start symptoms and vehicle details are reviewed.'
  },
  {
    slug: 'diagnostic-visit',
    name: 'Diagnostic Visit',
    startingLaborPrice: 100,
    description: 'Mobile diagnostic visit for warning lights, no-start, or drivability symptoms.'
  },
  {
    slug: 'advanced-diagnostic-troubleshooting',
    name: 'Advanced Diagnostic / Troubleshooting',
    startingLaborPrice: 150,
    description: 'Advanced troubleshooting quote request for complex vehicle symptoms.'
  }
];

const PUBLIC_SERVICE_NAMES = SERVICES
  .filter((service) => service.publicRequest)
  .map((service) => service.name);

const AUTO_REPAIR_SERVICE_NAMES = AUTO_REPAIR_SERVICES.map((service) => service.name);

module.exports = {
  SERVICES,
  REQUEST_STATUSES,
  PUBLIC_SERVICE_NAMES,
  AUTO_REPAIR_SERVICES,
  AUTO_REPAIR_SERVICE_NAMES
};
