;'use strict'

module.exports = Regions
var PDS = require('poisson-disc-sampler')
  , Voronoi = require('voronoi')
  , Noise = require('../misc/noise')

// fixes rounding of float values in javascript
Number.prototype.round = function(num_places) {
  return +(Math.round(this +'e+'+ num_places) +'e-'+ num_places)
}

// Constructor:
function Regions() {
  if (! (this instanceof Regions)) return new Regions()
}
var proto = Regions.prototype


// Public API:
proto.create = create_regions


// Class Methods:
function create_regions(map_size, min_distance) {
  var sampler = PDS(map_size - min_distance, map_size - min_distance, min_distance)
    , voronoi = new Voronoi()
    , bbox = { xl: 0, xr: map_size, yt: 0, yb: map_size }
    , points = []

  // generate sample points
  while ((sample = sampler())) {
    points.push({ x: sample[0] + min_distance*0.5, y: sample[1] + min_distance*0.5 })
  }

  var voronoi_regions = voronoi.compute(points, bbox)
    , regions = new Array(points.length)

  for (var i = 0, il = points.length; i < il; i++) {
    var idx = points[i].voronoiId
    regions[idx] = {
        center: {
            position: {
                x: points[i].x
              , y: 0
              , z: points[i].y
            }
        }
      , edges: {}
      , vertices: {}
    }
  }

  // build a structure containing all region info (verts, edges, neighbors)
  voronoi_regions.cells.forEach(function(cell) {
    var site = cell.site
      , site_id = site.voronoiId
      , half_edges = cell.halfedges
      , num_verts = 0
      , num_edges = 0
      , verts = {}      // Note: starts as an object because need to filter out duplicate vertices
      , edges = []
      , neighbors = []
      , weld_tile_edges = {}

    // Note: requires db lookup to confirm neighbor tile exists
    weld_tile_edges.south = { neighbor_exists: false, points: [] }
    weld_tile_edges.east  = { neighbor_exists: false, points: [] }

    half_edges.forEach(function(half_edge) {

      // vertices
      var v1 = half_edge.edge.va
        , v2 = half_edge.edge.vb

      var key1 = ''+ v1.x +','+ v1.y
      verts[key1] = { position: { x: v1.x, y: 0, z: v1.y } }
      var key2 = ''+ v2.x +','+ v2.y
      verts[key2] = { position: { x: v2.x, y: 0, z: v2.y } }

      // edges
      if (half_edge.edge.rSite) {
        var lSite_id = half_edge.edge.lSite.voronoiId
          , rSite_id = half_edge.edge.rSite.voronoiId
        edges.push({ voronoi_verts: [ key1, key2 ], delaunay_neighbor: lSite_id === site_id ? rSite_id : lSite_id })
      } else {
        // mark as boundary
        regions[site_id].boundary = true
      }

      // neighbors
      if ( half_edge.edge.lSite && half_edge.edge.lSite.voronoiId !== site_id)
        neighbors.push(half_edge.edge.lSite.voronoiId)

      if ( half_edge.edge.rSite && half_edge.edge.rSite.voronoiId !== site_id)
        neighbors.push(half_edge.edge.rSite.voronoiId)
    })

    // convert *only* the unique vertices into an array structure
    regions[site_id].vertices = []
    Object.keys(verts).forEach(function(key) { regions[site_id].vertices.push(verts[key].position) })

    // edges
    for (var i = 0, il = edges.length; i < il; i++) {
      var vert_ids = []
      edges[i].voronoi_verts.forEach(function(vert) {

        // decode the voronoi-edge vertices
        Object.keys(verts).forEach(function(key, j) {
          if (key === vert) vert_ids.push(j)
        })
      })

      // use cross-product to calculate correct order of edge vertices
      var v1 = regions[site_id].vertices[vert_ids[0]]
        , v2 = regions[site_id].vertices[vert_ids[1]]
        , v3 = regions[site_id].center.position
        , res = cross_product(v1, v2, v3)
      if (res.y < 0) edges[i].voronoi_verts = [ vert_ids[1], vert_ids[0] ]
      else edges[i].voronoi_verts = [ vert_ids[0], vert_ids[1] ]
    }
    regions[site_id].edges = edges

    // neighbors
    regions[site_id].neighbors = neighbors
  })

  // terraform
  add_noise.call(regions)

  return regions
}

function cross_product(v1, v2, origin) {
  // credit to the authors of three.js (https://raw.githubusercontent.com/mrdoob/three.js/master/src/math/Vector3.js)
  var sn1 = sub_vectors(v1, origin)
  var sn2 = sub_vectors(v2, origin)
  return cross_vectors(sn1, sn2)
}

function sub_vectors(v1, v2) {
  // credit to the authors of three.js (https://raw.githubusercontent.com/mrdoob/three.js/master/src/math/Vector3.js)
  var x = v1.x - v2.x
    , y = v1.y - v2.y
    , z = v1.z - v2.z
  return { x: x, y: y, z: z }
}

function cross_vectors(v1, v2) {
  // credit to the authors of three.js (https://raw.githubusercontent.com/mrdoob/three.js/master/src/math/Vector3.js)
  var x = v1.y * v2.z - v1.z * v2.y
    , y = v1.z * v2.x - v1.x * v2.z
    , z = v1.x * v2.y - v1.y * v2.x
  return { x: x, y: y, z: z }
}

function add_noise() {
  var regions = this

  // generate baseline noises
  var noise = {
      pink: Noise(-1, regions.length)       // defines elevation
    , blue: Noise( 1, regions.length)       // defines moisture (as a percentage)
    , bounds: {
        pink: { min:  Infinity, max: -Infinity }
      , blue: { min:  Infinity, max: -Infinity }
    }
    , totals: { pink: 0, blue: 0 }
  }

  var near_center_regions = []
    , pink_bounds = noise.bounds.pink
    , blue_bounds = noise.bounds.blue

  // analyze the generated noise values
  for (var i = 0, il = regions.length; i < il; i++) {
    pink_bounds.min = noise.pink[i] < pink_bounds.min ? noise.pink[i] : pink_bounds.min
    pink_bounds.max = noise.pink[i] > pink_bounds.max ? noise.pink[i] : pink_bounds.max
    blue_bounds.min = noise.blue[i] < blue_bounds.min ? noise.blue[i] : blue_bounds.min
    blue_bounds.max = noise.blue[i] > blue_bounds.max ? noise.blue[i] : blue_bounds.max

    // locate a near-center node
    // Note: remove hard-coded values
    var dist_x = regions[i].center.position.x - 128                          // map_size = 256
      , dist_y = regions[i].center.position.z - 128                          // map_size = 256
      , near_center = Math.sqrt(dist_x * dist_x + dist_y * dist_y) < 15      // min_dist =  10
    if (near_center) near_center_regions.push(i)
  }
  noise.totals.pink = Math.abs(pink_bounds.min) + pink_bounds.max
  noise.totals.blue = Math.abs(blue_bounds.min) + blue_bounds.max
  noise.starting_node = near_center_regions[ parseInt(Math.random() * near_center_regions.length) ]

  apply_noise_recursively.call(regions, noise)
}

function apply_noise_recursively(noise) {
  var regions = this
    , regions_visited = {}
    , iteration = 0

  function apply_noise(delaunay_neighbor) {

    // Note: called recursively
    var neighbors = regions[delaunay_neighbor].neighbors
      , pink_bounds = noise.bounds.pink
      , blue_bounds = noise.bounds.blue
      , elevation = ((noise.pink[iteration] + Math.abs(pink_bounds.min)) / noise.totals.pink) *  10
      , moisture  = ((noise.blue[iteration] + Math.abs(blue_bounds.min)) / noise.totals.blue) * 100

    regions[delaunay_neighbor].center.position.y = elevation.round(3)
    regions[delaunay_neighbor].moisture = moisture.round(2)
    if (regions[delaunay_neighbor].moisture > 84) regions[delaunay_neighbor].water = true
    iteration++
    regions_visited[delaunay_neighbor] = true

    // repeat for neighbors of this node (which are NOT already visited !!)
    for (var i = 0, il = neighbors.length; i < il; i++) {
      if (! regions_visited[neighbors[i]]) apply_noise(neighbors[i])
    }
  }
  return apply_noise(noise.starting_node)
}
