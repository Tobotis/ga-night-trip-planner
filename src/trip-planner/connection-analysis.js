function safeSecondsBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;

  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffSec = (end - start) / 1000;

  if (!Number.isFinite(diffSec) || diffSec < 0) return null;
  return diffSec;
}

function transferWaitStats(connection) {
  const journeySections = (connection.sections || []).filter(
    (section) =>
      section.journey &&
      section.departure?.departure &&
      section.arrival?.arrival
  );

  let previousArrival = null;
  let totalWaitSec = 0;
  let maxWaitSec = 0;
  let waitCount = 0;

  for (const section of journeySections) {
    const departure = new Date(section.departure.departure);
    const arrival = new Date(section.arrival.arrival);

    if (previousArrival) {
      const waitSec = (departure - previousArrival) / 1000;
      if (Number.isFinite(waitSec) && waitSec > 0) {
        totalWaitSec += waitSec;
        maxWaitSec = Math.max(maxWaitSec, waitSec);
        waitCount += 1;
      }
    }

    if (!Number.isNaN(arrival.getTime())) {
      previousArrival = arrival;
    }
  }

  return {
    totalWaitSec,
    maxWaitSec,
    waitCount,
  };
}

export function analyzeConnection(connection) {
  const departureIso = connection.from?.departure;
  const arrivalIso = connection.to?.arrival;
  const durationSec = safeSecondsBetween(departureIso, arrivalIso);
  const transferStats = transferWaitStats(connection);

  return {
    departureIso,
    arrivalIso,
    durationSec,
    transfers: Number(connection.transfers ?? 0),
    transferWaitSec: transferStats.totalWaitSec,
    maxTransferWaitSec: transferStats.maxWaitSec,
    waitCount: transferStats.waitCount,
  };
}

function compareAsc(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareDesc(a, b) {
  return compareAsc(b, a);
}

function transferPenaltyScore(candidate) {
  const totalWaitMin = candidate.totalTransferWaitSec / 60;
  const maxWaitMin = candidate.maxTransferWaitSec / 60;

  // Strongly punish long single waits so a route with one painful transfer
  // is ranked much lower than smoother alternatives.
  return (
    totalWaitMin +
    maxWaitMin * 2 +
    Math.max(0, maxWaitMin - 15) * 4 +
    Math.max(0, maxWaitMin - 30) * 8
  );
}

function createCandidates(outboundItems, returnItems, minGroundSec, maxGroundSec) {
  const outbound = outboundItems.map((item) => ({
    item,
    metrics: analyzeConnection(item.connection),
  }));

  const returns = returnItems.map((item) => ({
    item,
    metrics: analyzeConnection(item.connection),
  }));

  const candidates = [];

  for (const out of outbound) {
    for (const ret of returns) {
      const groundSec = safeSecondsBetween(out.metrics.arrivalIso, ret.metrics.departureIso);
      if (groundSec == null || groundSec < minGroundSec || groundSec > maxGroundSec) continue;

      const totalTravelSec = (out.metrics.durationSec ?? Number.POSITIVE_INFINITY) +
        (ret.metrics.durationSec ?? Number.POSITIVE_INFINITY);
      const totalTransfers = out.metrics.transfers + ret.metrics.transfers;
      const totalTransferWaitSec = out.metrics.transferWaitSec + ret.metrics.transferWaitSec;
      const maxTransferWaitSec = Math.max(out.metrics.maxTransferWaitSec, ret.metrics.maxTransferWaitSec);
      const directLegs = (out.metrics.transfers === 0 ? 1 : 0) + (ret.metrics.transfers === 0 ? 1 : 0);

      candidates.push({
        key: `${out.item.tableIndex}-${ret.item.tableIndex}`,
        outbound: out,
        ret,
        totalTravelSec,
        totalTransfers,
        totalTransferWaitSec,
        maxTransferWaitSec,
        transferPenalty: 0,
        groundSec,
        directLegs,
        bothLegsDirect: directLegs === 2,
      });
    }
  }

  return candidates.map((candidate) => ({
    ...candidate,
    transferPenalty: transferPenaltyScore(candidate),
  }));
}

export function listRoundTripCandidates(outboundItems, returnItems, options = {}) {
  const minGroundSec = (options.minGroundMinutes ?? 45) * 60;
  const maxGroundSec =
    options.maxGroundMinutes == null
      ? Number.POSITIVE_INFINITY
      : options.maxGroundMinutes * 60;
  return createCandidates(outboundItems, returnItems, minGroundSec, maxGroundSec);
}

function compareByTravel(a, b, preferredGroundSec) {
  let result = compareAsc(a.totalTravelSec, b.totalTravelSec);
  if (result !== 0) return result;

  result = compareAsc(a.totalTransfers, b.totalTransfers);
  if (result !== 0) return result;

  result = compareAsc(
    Math.abs(a.groundSec - preferredGroundSec),
    Math.abs(b.groundSec - preferredGroundSec)
  );
  if (result !== 0) return result;

  result = compareAsc(a.transferPenalty, b.transferPenalty);
  if (result !== 0) return result;

  return compareAsc(a.key, b.key);
}

function compareByOverall(a, b, mode, preferredGroundSec) {
  const groundDistanceA = Math.abs(a.groundSec - preferredGroundSec);
  const groundDistanceB = Math.abs(b.groundSec - preferredGroundSec);

  if (mode === "both_direct") {
    let result = compareDesc(a.bothLegsDirect ? 1 : 0, b.bothLegsDirect ? 1 : 0);
    if (result !== 0) return result;

    // For direct options, user-selected city-time preference should drive the pick.
    result = compareAsc(groundDistanceA, groundDistanceB);
    if (result !== 0) return result;

    result = compareAsc(a.totalTravelSec, b.totalTravelSec);
    if (result !== 0) return result;

    result = compareAsc(a.totalTransfers, b.totalTransfers);
    if (result !== 0) return result;

    return compareAsc(a.key, b.key);
  }

  if (mode === "any_direct") {
    let result = compareDesc(a.directLegs, b.directLegs);
    if (result !== 0) return result;

    result = compareAsc(a.totalTransfers, b.totalTransfers);
    if (result !== 0) return result;

    result = compareAsc(a.transferPenalty, b.transferPenalty);
    if (result !== 0) return result;

    result = compareAsc(groundDistanceA, groundDistanceB);
    if (result !== 0) return result;

    result = compareAsc(a.totalTravelSec, b.totalTravelSec);
    if (result !== 0) return result;

    return compareAsc(a.key, b.key);
  }

  let result = compareAsc(a.totalTransfers, b.totalTransfers);
  if (result !== 0) return result;

  result = compareAsc(a.transferPenalty, b.transferPenalty);
  if (result !== 0) return result;

  result = compareAsc(groundDistanceA, groundDistanceB);
  if (result !== 0) return result;

  result = compareAsc(a.totalTravelSec, b.totalTravelSec);
  if (result !== 0) return result;

  return compareAsc(a.key, b.key);
}

export function recommendRoundTrips(outboundItems, returnItems, options = {}) {
  const minGroundSec = (options.minGroundMinutes ?? 45) * 60;
  const maxGroundSec =
    options.maxGroundMinutes == null
      ? Number.POSITIVE_INFINITY
      : options.maxGroundMinutes * 60;
  const preferredGroundSec = (options.preferredGroundMinutes ?? 180) * 60;
  const alternativesLimit = options.alternativesLimit ?? 5;

  const candidates = createCandidates(outboundItems, returnItems, minGroundSec, maxGroundSec);
  if (candidates.length === 0) {
    return {
      bestOverall: null,
      fastest: null,
      alternatives: [],
      candidatesCount: 0,
      mode: "none",
      hasAnyDirect: false,
    };
  }

  const hasBothDirect = candidates.some((candidate) => candidate.bothLegsDirect);
  const hasAnyDirect = candidates.some((candidate) => candidate.directLegs > 0);

  const mode = hasBothDirect ? "both_direct" : hasAnyDirect ? "any_direct" : "no_direct";

  const sortedOverall = [...candidates].sort((a, b) => compareByOverall(a, b, mode, preferredGroundSec));
  const bestOverall = sortedOverall[0];
  const fastest = [...candidates].sort((a, b) => compareByTravel(a, b, preferredGroundSec))[0];
  const excludedKeys = new Set([
    bestOverall?.key,
    fastest?.key,
  ].filter(Boolean));
  const alternatives = sortedOverall
    .filter((candidate) => !excludedKeys.has(candidate.key))
    .slice(0, alternativesLimit);

  return {
    bestOverall,
    fastest,
    alternatives,
    candidatesCount: candidates.length,
    mode,
    hasAnyDirect,
  };
}
