import "dotenv/config";

const DEFAULT_TIMEOUT_MS = 8000;
const API_BASE_URL =
  (process.env.NIPOST_API_BASE_URL || "https://api.postcode.gov.ng").replace(/\/+$/, "");
const POSTCODE_PATTERN = /^[A-Z]{2}\d{2}[A-Z]\d{2}[A-Z]{2}\d{2}$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalizePostcode(value) {
  const compact = cleanString(value).toUpperCase().replace(/[\s-]/g, "");
  if (!POSTCODE_PATTERN.test(compact)) return "";
  return `${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4, 7)}-${compact.slice(7, 9)}-${compact.slice(9, 11)}`;
}

function isNipostConfigured() {
  return Boolean(cleanString(process.env.NIPOST_API_KEY));
}

function configurationError() {
  const error = new Error(
    "NIPOST is not configured. Set NIPOST_API_KEY in the CivicPort server environment."
  );
  error.code = "NIPOST_NOT_CONFIGURED";
  return error;
}

async function requestNipost(path, params = {}) {
  const apiKey = cleanString(process.env.NIPOST_API_KEY);
  if (!apiKey) throw configurationError();

  const url = new URL(path, `${API_BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, Number(process.env.NIPOST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS)
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(
        response.status === 401 || response.status === 403
          ? "NIPOST rejected the API key or its permissions."
          : response.status === 404
            ? "The requested NIPOST endpoint or postcode was not found. Check the API documentation and postcode."
            : response.status === 429
              ? "NIPOST rate limit reached. Please retry later."
              : `NIPOST postcode request failed with HTTP ${response.status}.`
      );
      error.code = "NIPOST_UPSTREAM_ERROR";
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("NIPOST postcode lookup timed out.");
      timeoutError.code = "NIPOST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function objectsToInspect(value) {
  const found = [];
  const queue = [value];
  const seen = new Set();

  while (queue.length && found.length < 60) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    found.push(current);

    if (Array.isArray(current)) {
      queue.push(...current.slice(0, 10));
      continue;
    }

    for (const [key, nested] of Object.entries(current)) {
      if (
        nested &&
        typeof nested === "object" &&
        /data|result|results|address|location|building|unit|payload|house|administrative/i.test(key)
      ) {
        queue.push(nested);
      }
    }
  }

  return found;
}

function firstValue(objects, keys) {
  for (const object of objects) {
    for (const key of keys) {
      const value = object?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "boolean") return value;
    }
  }
  return null;
}

function normalizePostcodeResponse(payload, requestedPostcode = "") {
  const objects = objectsToInspect(payload);
  const postcodeValue = firstValue(objects, [
    "postcode", "digitalPostcode", "digital_postcode", "post_code",
    "postcodeCode", "postcode_code", "code", "addressCode", "address_code"
  ]);

  const returnedPostcode =
    typeof postcodeValue === "string"
      ? canonicalizePostcode(postcodeValue)
      : "";
  const normalizedRequested = canonicalizePostcode(requestedPostcode);
  const postcode = returnedPostcode || normalizedRequested;

  const latitudeValue = firstValue(objects, [
    "latitude", "lat", "buildingLatitude", "building_latitude"
  ]);
  const longitudeValue = firstValue(objects, [
    "longitude", "lon", "lng", "long", "buildingLongitude", "building_longitude"
  ]);

  const recentAddress = objects.find(item =>
    item && typeof item === "object" && item.recent_house_address
  )?.recent_house_address;

  const administrativeAddress = objects.find(item =>
    item && typeof item === "object" && item.administrative_address
  )?.administrative_address;

  const displayName = firstValue(objects, [
    "displayName", "display_name", "formattedAddress", "formatted_address",
    "addressLabel", "address_label", "fullAddress", "full_address", "label"
  ]);

  const explicitValidity = firstValue(objects, [
    "valid", "isValid", "is_valid", "verified", "isVerified", "is_verified", "found", "success"
  ]);

  const codeMatches = Boolean(
    postcode && (!normalizedRequested || postcode === normalizedRequested)
  );
  const explicitSuccess =
    explicitValidity === true ||
    explicitValidity === "true" ||
    explicitValidity === 1;
  const explicitFailure =
    explicitValidity === false ||
    explicitValidity === "false" ||
    explicitValidity === 0;

  const addressParts = [
    typeof recentAddress === "object" ? recentAddress?.recent : recentAddress,
    typeof administrativeAddress === "object" ? administrativeAddress?.locality_name : "",
    typeof administrativeAddress === "object" ? administrativeAddress?.lga_name : "",
    typeof administrativeAddress === "object" ? administrativeAddress?.state_name : "",
  ].filter(value => typeof value === "string" && value.trim());

  return {
    postcode: postcode || normalizedRequested || null,
    verified: Boolean(!explicitFailure && (explicitSuccess || (returnedPostcode && codeMatches))),
    displayName:
      (typeof displayName === "string" ? displayName : "") ||
      [...new Set(addressParts)].join(", ") ||
      null,
    latitude: latitudeValue === null ? null : Number(latitudeValue),
    longitude: longitudeValue === null ? null : Number(longitudeValue),
  };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRadians = value => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export { isNipostConfigured };

export async function verifyDigitalPostcode(postcodeInput, coordinates = {}) {
  const postcode = canonicalizePostcode(postcodeInput);

  if (!postcode) {
    return {
      verified: false,
      postcode: cleanString(postcodeInput),
      status: "invalid_format",
      error: "Enter a valid Nigerian Digital Postcode, for example EK-01-A03-FK-01."
    };
  }

  const level = Math.max(1, Math.min(5, Number(process.env.NIPOST_LOOKUP_LEVEL) || 1));
  const payload = await requestNipost("/v1/lookup", {
    code: postcode,
    level,
  });

  const result = normalizePostcodeResponse(payload, postcode);
  if (!result.verified) {
    return {
      ...result,
      postcode,
      status: "not_found",
      error: "NIPOST did not confirm this postcode. Check it and try again."
    };
  }

  let coordinatesMatch = null;
  let distanceFromGpsMeters = null;
  const gpsLat = Number(coordinates.latitude);
  const gpsLon = Number(coordinates.longitude);

  if (
    Number.isFinite(gpsLat) &&
    Number.isFinite(gpsLon) &&
    Number.isFinite(result.latitude) &&
    Number.isFinite(result.longitude)
  ) {
    distanceFromGpsMeters = Math.round(
      distanceMeters(gpsLat, gpsLon, result.latitude, result.longitude)
    );
    const maxDistance = Math.max(
      25,
      Number(process.env.NIPOST_MAX_DISTANCE_METERS) || 250
    );
    coordinatesMatch = distanceFromGpsMeters <= maxDistance;
  }

  if (coordinatesMatch === false) {
    return {
      ...result,
      postcode,
      verified: false,
      coordinatesMatch: false,
      distanceFromGpsMeters,
      status: "location_mismatch",
      error: `The postcode's mapped location is approximately ${distanceFromGpsMeters}m from your GPS position. Confirm that you selected the correct building or location.`
    };
  }

  return {
    ...result,
    postcode,
    verified: true,
    coordinatesMatch,
    distanceFromGpsMeters,
    status: coordinatesMatch === true
      ? "verified_location_match"
      : "verified_postcode",
    message: coordinatesMatch === true
      ? "NIPOST confirmed the postcode and its mapped coordinates match your GPS location."
      : "NIPOST confirmed the postcode. The API response did not provide coordinates for an independent GPS-distance comparison."
  };
}

export async function lookupDigitalPostcodeByCoordinates(latitudeInput, longitudeInput) {
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    const error = new Error("Valid GPS coordinates are required.");
    error.code = "INVALID_COORDINATES";
    throw error;
  }

  const radius = Math.max(
    25,
    Math.min(250, Number(process.env.NIPOST_REVERSE_GEOCODE_RADIUS_METERS) || 25)
  );
  const payload = await requestNipost("/v1/reverse-geocode", {
    lat: latitude,
    lon: longitude,
    radius_m: radius,
  });

  const result = normalizePostcodeResponse(payload);
  if (!result.postcode || !result.verified) {
    const error = new Error(
      "NIPOST did not return a confirmed Digital Postcode near these coordinates. You can enter the correct building postcode manually."
    );
    error.code = "NIPOST_POSTCODE_NOT_FOUND";
    throw error;
  }

  const verification = await verifyDigitalPostcode(result.postcode, {
    latitude,
    longitude,
  });

  if (!verification.verified) {
    const error = new Error(
      verification.error ||
      "NIPOST could not verify the postcode returned for these coordinates."
    );
    error.code = verification.status || "NIPOST_VERIFICATION_FAILED";
    throw error;
  }

  const reverseObjects = objectsToInspect(payload);
  const reverseDistanceValue = firstValue(reverseObjects, [
    "distance_m",
    "distanceMeters",
    "distance_meters",
    "distance",
  ]);
  const reverseDistance = Number(reverseDistanceValue);
  const hasReverseDistance =
    reverseDistanceValue !== null &&
    Number.isFinite(reverseDistance) &&
    reverseDistance >= 0;

  if (hasReverseDistance && reverseDistance > radius) {
    const error = new Error(
      `NIPOST's nearest postcode is ${Math.round(reverseDistance)}m from the GPS point, outside the requested ${radius}m radius.`
    );
    error.code = "NIPOST_LOCATION_MISMATCH";
    throw error;
  }

  // A successful official reverse-geocode result was requested within
  // `radius`; treat it as a coordinate-linked postcode. Preserve the
  // measured distance when the API supplies it.
  return {
    ...verification,
    coordinatesMatch: true,
    distanceFromGpsMeters: hasReverseDistance
      ? Math.round(reverseDistance)
      : null,
    status: "verified_location_match",
    message: hasReverseDistance
      ? `NIPOST found this postcode ${Math.round(reverseDistance)}m from the GPS point.`
      : `NIPOST resolved this postcode from GPS within the requested ${radius}m search radius.`,
  };
}
