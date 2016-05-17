;'use strict'

module.exports = Regions
var PDS = require('poisson-disc-sampler')
  , Voronoi = require('voronoi')
  , Noise = require('./noise')

// private implementation of '[].unique'
// Array.prototype.unique = function() {
//   var orig = {}
//     , i
//     , il = this.length
//     , res = []
//   for (i = 0; i < il; i++) orig[this[i]] = this[i]
//   for (i in orig) res.push(orig[i])
//   return res
// }

// Constructor:
function Regions() {
  if (! (this instanceof Regions)) return new Regions()
}
var proto = Regions.prototype


// Public API:
proto.create = create_regions
proto.terraform = add_noise


// Class Methods:
function create_regions(map_size, min_distance) {
  var sampler = PDS(map_size - min_distance, map_size - min_distance, min_distance)
    , voronoi = new Voronoi()
    , bbox = { xl: 0, xr: map_size, yt: 0, yb: map_size }
    , nodes = []

  // generate sample nodes (points)
  while ((sample = sampler())) {
    nodes.push({ x: sample[0] + min_distance*0.5, y: sample[1] + min_distance*0.5 })
  }

  //

  var voronoi_regions = voronoi.compute(nodes, bbox)
    , regions = new Array(nodes.length)

  for (var i = 0, il = nodes.length; i < il; i++) {
    var idx = nodes[i].voronoiId
    regions[idx] = {
        center: {
            position: {
                x: nodes[i].x
              , y: 0
              , z: nodes[i].y
            }
        }
      , edges: {}
      , vertices: {}
    }
  }

  // locate neighbor nodes
  voronoi_regions.cells.forEach(function(cell) {
    var site = cell.site
      , site_id = site.voronoiId
      , half_edges = cell.halfedges
      , neighbors = []

    half_edges.forEach(function(half_edge) {
      if ( half_edge.edge.lSite && half_edge.edge.lSite.voronoiId !== site_id)
        neighbors.push(half_edge.edge.lSite.voronoiId)

      if ( half_edge.edge.rSite && half_edge.edge.rSite.voronoiId !== site_id)
        neighbors.push(half_edge.edge.rSite.voronoiId)
    })

    regions[site_id].neighbors = neighbors       /*new Array().unique.call(neighbors)*/
  })

  return { regions: regions, voronoi_regions: voronoi_regions }
}

function _original__create_regions(nodes, map_size) {
  // var voronoi = new Voronoi()
  //   , bbox = { xl: 0, xr: map_size, yt: 0, yb: map_size }

  // var regions = voronoi.compute(nodes, bbox)
  //   , new_nodes = new Array(nodes.length)

  // for (var i = 0, il = nodes.length; i < il; i++) {
  //   var idx = nodes[i].voronoiId
  //   new_nodes[idx] = { position: { x: nodes[i].x, y: 0, z: nodes[i].y } }
  // }

  // // locate neighbor nodes
  // regions.cells.forEach(function(cell) {
  //   var site = cell.site
  //     , site_id = site.voronoiId
  //     , half_edges = cell.halfedges
  //     , neighbors = []

  //   half_edges.forEach(function(half_edge) {
  //     if ( half_edge.edge.lSite && half_edge.edge.lSite.voronoiId !== site_id)
  //       neighbors.push(half_edge.edge.lSite.voronoiId)

  //     if ( half_edge.edge.rSite && half_edge.edge.rSite.voronoiId !== site_id)
  //       neighbors.push(half_edge.edge.rSite.voronoiId)
  //   })

  //   new_nodes[site_id].neighbors = new Array().unique.call(neighbors)
  // })

  // return { nodes: new_nodes, regions: regions }
}

function add_noise(nodes) {
  // generate baseline noises
  var noise = {
      pink: Noise(-1, nodes.length)       // defines elevation
    , blue: Noise( 1, nodes.length)       // defines moisture (as a percentage)
    , bounds: {
        pink: { min:  Infinity, max: -Infinity }
      , blue: { min:  Infinity, max: -Infinity }
    }
    , totals: { pink: 0, blue: 0 }
  }

  var near_center_nodes = []
    , pink_bounds = noise.bounds.pink
    , blue_bounds = noise.bounds.blue

  // analyze the generated noise values
  for (var i = 0, il = nodes.length; i < il; i++) {
    pink_bounds.min = noise.pink[i] < pink_bounds.min ? noise.pink[i] : pink_bounds.min
    pink_bounds.max = noise.pink[i] > pink_bounds.max ? noise.pink[i] : pink_bounds.max
    blue_bounds.min = noise.blue[i] < blue_bounds.min ? noise.blue[i] : blue_bounds.min
    blue_bounds.max = noise.blue[i] > blue_bounds.max ? noise.blue[i] : blue_bounds.max

    // locate a near-center node
    // Note: remove hard-coded values
    var dist_x = nodes[i].center.position.x - 128                                   // map_size = 256
      , dist_y = nodes[i].center.position.z - 128                                   // map_size = 256
      , near_center = Math.sqrt(dist_x * dist_x + dist_y * dist_y) < 15      // min_dist =  10
    if (near_center) near_center_nodes.push(i)
  }
  noise.totals.pink = Math.abs(pink_bounds.min) + pink_bounds.max
  noise.totals.blue = Math.abs(blue_bounds.min) + blue_bounds.max
  noise.starting_node = near_center_nodes[ parseInt(Math.random() * near_center_nodes.length) ]

  apply_noise_recursively.call(nodes, noise)
  return nodes
}

function apply_noise_recursively(noise) {
  var nodes = this
    , nodes_visited = {}
    , iteration = 0

  function _again(node_neighbor) {
    var neighbors = nodes[node_neighbor].neighbors
      , pink_bounds = noise.bounds.pink
      , blue_bounds = noise.bounds.blue
      , elevation = ((noise.pink[iteration] + Math.abs(pink_bounds.min)) / noise.totals.pink) *  10
      , moisture  = ((noise.blue[iteration] + Math.abs(blue_bounds.min)) / noise.totals.blue) * 100

    nodes[node_neighbor].center.position.y = elevation.round(3)
    nodes[node_neighbor].moisture = moisture.round(2)
    if (nodes[node_neighbor].moisture > 84) nodes[node_neighbor].water = true
    iteration++
    nodes_visited[node_neighbor] = true

    // repeat for neighbors of this node (which are NOT already visited !!)
    for (var i = 0, il = neighbors.length; i < il; i++) {
      if (! nodes_visited[neighbors[i]]) _again(neighbors[i])
    }
  }
  return _again(noise.starting_node)
}
