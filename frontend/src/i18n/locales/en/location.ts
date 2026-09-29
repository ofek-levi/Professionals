/** Location picking, device location and map copy. */
export const location = {
  search: {
    label: 'Service address',
    placeholder: 'Search for a street, number and city',
    searching: 'Searching…',
    noResults: 'No matching addresses. Try adding the city.',
    suggestions: 'Address suggestions',
  },
  currentLocation: {
    action: 'Use my current location',
    locating: 'Finding your location…',
    usedLastKnown: 'Using your last known location. Drag the pin if it’s not accurate.',
  },
  errors: {
    permissionDenied: {
      title: 'Location access is off',
      message: 'Allow location access to use where you are now, or search for the address instead.',
    },
    permissionBlocked: {
      title: 'Location access is blocked',
      message: 'Turn on location for this app in your device settings, or search for the address instead.',
    },
    servicesDisabled: {
      title: 'Location services are off',
      message: 'Turn on location services in your device settings and try again.',
    },
    timeout: {
      title: 'We couldn’t find you',
      message: 'Getting your position took too long. Try again or search for the address.',
    },
    unavailable: {
      title: 'Location unavailable',
      message: 'Your current location isn’t available on this device. Search for the address instead.',
    },
    reverseGeocode: 'We couldn’t look up this spot. You can type the address below.',
    search: 'Address search isn’t available right now. Try again in a moment.',
  },
  openSettings: 'Open settings',
  turnOnLocation: 'Turn on location',
  map: {
    label: 'Map',
    hint: 'Tap the map or drag the pin to set the exact spot',
    pin: 'Selected location',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    marker: 'Map marker: {{label}}',
    unavailable: 'The map couldn’t load',
  },
  fields: {
    addressLine: 'Street and number',
    addressLinePlaceholder: 'e.g. Dizengoff St 120',
    city: 'City',
    cityPlaceholder: 'e.g. Tel Aviv-Yafo',
    details: 'Apartment, floor, entrance',
    detailsPlaceholder: 'e.g. Apt 12, 3rd floor, gate code 1234',
    detailsHelper: 'Shared only with the professional you choose.',
  },
  resolving: 'Looking up the address…',
} as const;
