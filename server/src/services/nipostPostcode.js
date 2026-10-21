
import "dotenv/config";

const DEFAULT_TIMEOUT_MS = 8000;
const API_BASE_URL = (
  process.env.NIPOST_API_BASE_URL || "https://api.postcode.gov.ng"
).replace(/\/+$/, "");

const POSTCODE_PATTERN = /^[A-Z]{2}\d{2}[A-Z]\d{2}[A-Z]{2}\d{2}$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalizePostcode(value) {
  const compact = cleanString(value)
    .toUpperCase()
    .replace(/[\s-]/g, "");

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

  if (!apiKey) {
    throw configurationError();
  }

  const url = new URL(path, `${API_BASE_URL}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(
    1000,
    Number(process.env.NIPOST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
      const upstreamDetail = text
        .replace(/[\r\n\t]+/g, " ")
        .slice(0, 500);

      console.error("[NIPOST API ERROR]", {
        endpoint: url.pathname,
        status: response.status,
        response: upstreamDetail,
      });

      const error = new Error(
        `NIPOST request to ${url.pathname} failed with HTTP ${response.status}.`
      );

      error.code = "NIPOST_UPSTREAM_ERROR";
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("NIPOST postcode lookup timed out.");
      timeoutError.code = "NIPOST_TIMEOUT";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Collect response objects, including the documented NIPOST structure:
 *
 * {
 *   "data": {
 *     "found": true,
 *     "unit": {
 *       "postcode": "EK-01-A03-FK-01",
 *       "distance_m": 12,
 *       "confidence": "high"
 *     }
 *   }
 * }
 */
function objectsToInspect(value) {
  const found = [];
  const queue = [value];
  const seen = new Set();

  while (queue.length && found.length < 100) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }

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
        /data|result|results|address|location|building|unit|payload|house|administrative/i.test(
          key
        )
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

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "boolean") {
        return value;
      }
    }
  }

  return null;
}

function hasOwn(object, key) {
  return Boolean(
    object &&
      typeof object === "object" &&
      Object.prototype.hasOwnProperty.call(object, key)
  );
}

function isExplicitTrue(value) {
  return (
    value === true ||
    value === 1 ||
    (typeof value === "string" && value.trim().toLowerCase() === "true")
  );
}

function isExplicitFalse(value) {
  return (
    value === false ||
    value === 0 ||
    (typeof value === "string" && value.trim().toLowerCase() === "false")
  );
}

/**
 * NIPOST's reverse-geocode endpoint uses data.found as its primary
 * match indicator and data.unit.postcode as the postcode.
 *
 * A requested postcode is never accepted merely because the caller
 * supplied it. NIPOST must return a matching code or an explicit
 * positive verification result.
 */
function normalizePostcodeResponse(payload, requestedPostcode = "") {
  const objects = objectsToInspect(payload);

  // Prefer the documented reverse-geocode result when present.
  const data = payload?.data;
  const unit = data?.unit;

  const rawPostcode =
    (typeof unit?.postcode === "string" && unit.postcode) ||
    firstValue(objects, [
      "postcode",
      "digitalPostcode",
      "digital_postcode",
      "post_code",
      "postcodeCode",
      "postcode_code",
      "code",
      "addressCode",
      "address_code",
    ]);

  const returnedPostcode = canonicalizePostcode(rawPostcode);
  const normalizedRequested = canonicalizePostcode(requestedPostcode);

  const postcodeMatchesRequest = Boolean(
    returnedPostcode &&
      (!normalizedRequested || returnedPostcode === normalizedRequested)
  );

  // data.found is authoritative for the documented reverse endpoint.
  const hasDocumentedFound =
    data &&
    typeof data === "object" &&
    hasOwn(data, "found");

  const foundValue = hasDocumentedFound
    ? data.found
    : firstValue(objects, ["found"]);

  const validityValues = [];

  for (const object of objects) {
    for (const key of [
      "valid",
      "isValid",
      "is_valid",
      "verified",
      "isVerified",
      "is_verified",
      "found",
      "success",
    ]) {
      if (hasOwn(object, key)) {
        validityValues.push(object[key]);
      }
    }
  }

  const explicitFailure = validityValues.some(isExplicitFalse);
  const explicitSuccess = validityValues.some(isExplicitTrue);

  // A documented reverse-geocode response must explicitly say found=true.
  // Other verification responses may use valid, verified, or success.
  const serviceConfirmed = hasDocumentedFound
    ? isExplicitTrue(foundValue)
    : explicitSuccess;

  const verified = Boolean(
    !explicitFailure &&
      returnedPostcode &&
      postcodeMatchesRequest &&
      serviceConfirmed
  );

  const latitudeValue = firstValue(objects, [
    "latitude",
    "lat",
    "buildingLatitude",
    "building_latitude",
  ]);

  const longitudeValue = firstValue(objects, [
    "longitude",
    "lon",
    "lng",
    "long",
    "buildingLongitude",
    "building_longitude",
  ]);

  const latitude =
    latitudeValue !== null && Number.isFinite(Number(latitudeValue))
      ? Number(latitudeValue)
      : null;

  const longitude =
    longitudeValue !== null && Number.isFinite(Number(longitudeValue))
      ? Number(longitudeValue)
      : null;

  const distanceValue =
    typeof unit?.distance_m === "number" ||
    typeof unit?.distance_m === "string"
      ? unit.distance_m
      : firstValue(objects, [
          "distance_m",
          "distanceMeters",
          "distance_meters",
          "distance",
        ]);

  const parsedDistance = Number(distanceValue);
  const distanceMeters =
    distanceValue !== null &&
    distanceValue !== "" &&
    Number.isFinite(parsedDistance) &&
    parsedDistance >= 0
      ? parsedDistance
      : null;

  const confidence =
    cleanString(unit?.confidence) ||
    cleanString(firstValue(objects, ["confidence"])) ||
    null;

  const addressParts = [
    typeof unit?.address === "string" ? unit.address : "",
    cleanString(unit?.locality_name),
    cleanString(unit?.lga_name),
    cleanString(unit?.state_name),
  ].filter(Boolean);

  const recentAddress = objects.find(
    item => item && typeof item === "object" && item.recent_house_address
  )?.recent_house_address;

  const administrativeAddress = objects.find(
    item => item && typeof item === "object" && item.administrative_address
  )?.administrative_address;

  if (typeof recentAddress === "string" && recentAddress.trim()) {
    addressParts.unshift(recentAddress.trim());
  } else if (
    recentAddress &&
    typeof recentAddress === "object" &&
    typeof recentAddress.recent === "string"
  ) {
    addressParts.unshift(recentAddress.recent.trim());
  }

  if (administrativeAddress && typeof administrativeAddress === "object") {
    addressParts.push(
      cleanString(administrativeAddress.locality_name),
      cleanString(administrativeAddress.lga_name),
      cleanString(administrativeAddress.state_name)
    );
  }

  const displayName =
    cleanString(unit?.display) ||
    cleanString(
      firstValue(objects, [
        "displayName",
        "display_name",
        "formattedAddress",
        "formatted_address",
        "addressLabel",
        "address_label",
        "fullAddress",
        "full_address",
        "label",
      ])
    ) ||
    [...new Set(addressParts.filter(Boolean))].join(", ") ||
    null;

  return {
    // Never fall back to a caller-supplied postcode when NIPOST returned none.
    postcode: returnedPostcode || null,
    verified,
    found: hasDocumentedFound ? isExplicitTrue(foundValue) : null,
    displayName,
    latitude,
    longitude,
    distanceMeters,
    confidence,
  };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRadians = value => (value * Math.PI) / 180;
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

function validateCoordinates(latitudeInput, longitudeInput) {
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

  return { latitude, longitude };
}

function getMaximumDistance() {
  return Math.max(
    25,
    Number(process.env.NIPOST_MAX_DISTANCE_METERS) || 250
  );
}

export { isNipostConfigured };

export async function verifyDigitalPostcode(postcodeInput, coordinates = {}) {
  const postcode = canonicalizePostcode(postcodeInput);

  if (!postcode) {
    return {
      verified: false,
      postcode: cleanString(postcodeInput) || null,
      status: "invalid_format",
      error:
        "The postcode format is invalid. A valid Nigerian Digital Postcode is required.",
    };
  }

  const level = Math.max(
    1,
    Math.min(5, Number(process.env.NIPOST_LOOKUP_LEVEL) || 1)
  );

  const payload = await requestNipost("/v1/lookup", {
    code: postcode,
    level,
  });

  const result = normalizePostcodeResponse(payload, postcode);

  if (!result.verified) {
    return {
      ...result,
      postcode: result.postcode,
      verified: false,
      status: "not_found",
      error: "NIPOST did not confirm this postcode.",
    };
  }

  let coordinatesMatch = null;
  let distanceFromGpsMeters = null;

  const gpsLat = Number(coordinates.latitude);
  const gpsLon = Number(coordinates.longitude);

  if (
    Number.isFinite(gpsLat) &&
    gpsLat >= -90 &&
    gpsLat <= 90 &&
    Number.isFinite(gpsLon) &&
    gpsLon >= -180 &&
    gpsLon <= 180 &&
    Number.isFinite(result.latitude) &&
    Number.isFinite(result.longitude)
  ) {
    distanceFromGpsMeters = Math.round(
      distanceMeters(
        gpsLat,
        gpsLon,
        result.latitude,
        result.longitude
      )
    );

    coordinatesMatch =
      distanceFromGpsMeters <= getMaximumDistance();
  }

  if (coordinatesMatch === false) {
    return {
      ...result,
      postcode,
      verified: false,
      coordinatesMatch: false,
      distanceFromGpsMeters,
      status: "location_mismatch",
      error: `The postcode's mapped location is approximately ${distanceFromGpsMeters}m from your GPS position. Confirm that the correct location was selected.`,
    };
  }

  return {
    ...result,
    postcode,
    verified: true,
    coordinatesMatch,
    distanceFromGpsMeters,
    status:
      coordinatesMatch === true
        ? "verified_location_match"
        : "verified_postcode",
    message:
      coordinatesMatch === true
        ? "NIPOST confirmed the postcode and its mapped coordinates match your GPS location."
        : "NIPOST confirmed the postcode. The lookup response did not provide building coordinates for an independent GPS-distance comparison.",
  };
}

export async function lookupDigitalPostcodeByCoordinates(
  latitudeInput,
  longitudeInput
) {
  const { latitude, longitude } = validateCoordinates(
    latitudeInput,
    longitudeInput
  );

  // NIPOST documents a maximum search radius of 250 metres.
  const radius = Math.max(
    25,
    Math.min(
      250,
      Number(process.env.NIPOST_REVERSE_GEOCODE_RADIUS_METERS) || 25
    )
  );

  const payload = await requestNipost("/v1/search/reverse", {
    lat: latitude,
    lng: longitude,
    max_distance_m: radius,
  });

  const result = normalizePostcodeResponse(payload);

  // The official reverse-geocode endpoint confirms matches with
  // data.found=true and returns the postcode in data.unit.postcode.
  if (
    result.found !== true ||
    !result.postcode ||
    !result.verified
  ) {
    const error = new Error(
      "NIPOST did not confirm a Digital Postcode near this GPS location. The postcode field will remain blank."
    );

    error.code = "NIPOST_POSTCODE_NOT_FOUND";
    throw error;
  }

  // The documented reverse response reports the distance from the GPS
  // point to the matched unit. Reject invalid/out-of-radius results.
  const reverseDistance = result.distanceMeters;

  if (
    reverseDistance !== null &&
    reverseDistance > radius
  ) {
    const error = new Error(
      `NIPOST's nearest postcode is ${Math.round(reverseDistance)}m from the GPS point, outside the requested ${radius}m radius.`
    );

    error.code = "NIPOST_LOCATION_MISMATCH";
    throw error;
  }

  // The official reverse-geocode response itself confirms the GPS-linked
  // building when data.found is true and data.unit.postcode is present.
  // Do not require a second /v1/lookup call here: that endpoint can have a
  // different response schema and may incorrectly reject a valid reverse hit.
  return {
    ...result,
    postcode: result.postcode,
    verified: true,
    coordinatesMatch: true,
    distanceFromGpsMeters:
      reverseDistance === null
        ? null
        : Math.round(reverseDistance),
    status: "verified_location_match",
    message:
      reverseDistance !== null
        ? `NIPOST found this postcode ${Math.round(reverseDistance)}m from the GPS point.`
        : `NIPOST matched this postcode to the captured GPS location within the requested ${radius}m search radius.`,
  };
}
