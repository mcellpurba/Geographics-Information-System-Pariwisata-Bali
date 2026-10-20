const { haversineDistance } = require('./haversine');

/**
 * Density-Based Spatial Clustering of Applications with Noise (DBSCAN)
 * @param {Array} points - Array of objects containing latitude and longitude
 * @param {number} epsKm - Epsilon neighborhood distance in kilometers
 * @param {number} minPts - Minimum points to form a dense core
 */
function runDBSCAN(points, epsKm = 8, minPts = 3) {
  const UNVISITED = 0;
  const VISITED = 1;
  const NOISE = -1;

  const status = new Array(points.length).fill(UNVISITED);
  const clusterAssignments = new Array(points.length).fill(null);
  let clusterId = 0;

  function regionQuery(pIdx) {
    const neighbors = [];
    const p = points[pIdx];
    for (let i = 0; i < points.length; i++) {
      const dist = haversineDistance(p.latitude, p.longitude, points[i].latitude, points[i].longitude);
      if (dist <= epsKm) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < points.length; i++) {
    if (status[i] === VISITED) continue;
    status[i] = VISITED;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      clusterAssignments[i] = NOISE;
    } else {
      clusterAssignments[i] = clusterId;
      const queue = [...neighbors];
      let qIdx = 0;
      while (qIdx < queue.length) {
        const neighborIdx = queue[qIdx++];
        if (status[neighborIdx] === UNVISITED) {
          status[neighborIdx] = VISITED;
          const nNeighbors = regionQuery(neighborIdx);
          if (nNeighbors.length >= minPts) {
            for (const n of nNeighbors) {
              if (!queue.includes(n)) queue.push(n);
            }
          }
        }
        if (clusterAssignments[neighborIdx] === null || clusterAssignments[neighborIdx] === NOISE) {
          clusterAssignments[neighborIdx] = clusterId;
        }
      }
      clusterId++;
    }
  }

  // Group clusters and compute metadata
  const clusters = [];
  for (let c = 0; c < clusterId; c++) {
    const cPoints = [];
    for (let i = 0; i < points.length; i++) {
      if (clusterAssignments[i] === c) {
        cPoints.push({ ...points[i], cluster_id: c });
      }
    }
    if (cPoints.length > 0) {
      const avgLat = cPoints.reduce((acc, cur) => acc + cur.latitude, 0) / cPoints.length;
      const avgLng = cPoints.reduce((acc, cur) => acc + cur.longitude, 0) / cPoints.length;

      // dominant kabupaten
      const kabCounts = {};
      cPoints.forEach(p => { kabCounts[p.kabupaten] = (kabCounts[p.kabupaten] || 0) + 1; });
      const topKab = Object.keys(kabCounts).sort((a, b) => kabCounts[b] - kabCounts[a])[0];

      // dominant category
      const catCounts = {};
      cPoints.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
      const topCat = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a])[0];

      clusters.push({
        cluster_id: c,
        name: `Kluster ${c + 1} (${topKab})`,
        count: cPoints.length,
        centroid: { lat: avgLat, lng: avgLng },
        dominant_kabupaten: topKab,
        dominant_category: topCat,
        places: cPoints
      });
    }
  }

  const noisePoints = [];
  for (let i = 0; i < points.length; i++) {
    if (clusterAssignments[i] === NOISE) {
      noisePoints.push({ ...points[i], cluster_id: -1 });
    }
  }

  return {
    clusters,
    noise: noisePoints,
    total_clusters: clusters.length,
    total_clustered_points: points.length - noisePoints.length,
    total_noise_points: noisePoints.length,
    params: { epsKm, minPts }
  };
}

module.exports = { runDBSCAN };
