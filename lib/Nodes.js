;'use strict'

module.exports = Nodes
var PDS = require('poisson-disc-sampler')
  , Voronoi = require('voronoi')
  , Noise = require('./noise')

// private implementation of '[].unique'
Array.prototype.unique = function() {
  var orig = {}
    , i
    , il = this.length
    , res = []
  for (i = 0; i < il; i++) orig[this[i]] = this[i]
  for (i in orig) res.push(orig[i])
  return res
}

// Constructor:
function Nodes() {
  if (! (this instanceof Nodes)) return new Nodes()
}
var proto = Nodes.prototype


// Public API:
proto.create = create_nodes
proto.create_regions = create_regions
proto.terraform = add_noise


// Class Methods:
function create_nodes(map_size, min_distance) {
  var sampler = PDS(map_size - min_distance, map_size - min_distance, min_distance)
    , nodes = []

  // generate sample nodes (points)
  while ((sample = sampler())) {
    nodes.push({ x: sample[0] + min_distance*0.5, y: sample[1] + min_distance*0.5 })
  }
  return nodes
}

function create_regions(nodes, map_size) {
  var voronoi = new Voronoi()
    , bbox = { xl: 0, xr: map_size, yt: 0, yb: map_size }

  var regions = voronoi.compute(nodes, bbox)
    , new_nodes = new Array(nodes.length)

  for (var i = 0, il = nodes.length; i < il; i++) {
    var idx = nodes[i].voronoiId
    new_nodes[idx] = { position: { x: nodes[i].x, y: 0, z: nodes[i].y } }
  }

  // locate neighbor nodes
  regions.cells.forEach(function(cell) {
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

    new_nodes[site_id].neighbors = new Array().unique.call(neighbors)
  })

  return { nodes: new_nodes, regions: regions }
}

function add_noise(nodes) {
  // generate baseline noises
  var noise = {
      pink: Noise(-1, nodes.length)       // defines elevation
    , blue: Noise( 1, nodes.length)       // defines moisture (as a percentage)
    , min_pink:  Infinity
    , max_pink: -Infinity
    , min_blue:  Infinity
    , max_blue: -Infinity
  }

  // analyze the generated noise values
  for (var i = 0, il = nodes.length; i < il; i++) {
    noise.min_pink = noise.pink[i] < noise.min_pink ? noise.pink[i] : noise.min_pink
    noise.max_pink = noise.pink[i] > noise.max_pink ? noise.pink[i] : noise.max_pink
    noise.min_blue = noise.blue[i] < noise.min_blue ? noise.blue[i] : noise.min_blue
    noise.max_blue = noise.blue[i] > noise.max_blue ? noise.blue[i] : noise.max_blue
  }
  noise.pink_total = Math.abs(noise.min_pink) + noise.max_pink
  noise.blue_total = Math.abs(noise.min_blue) + noise.max_blue

  apply_noise_recursively.call(nodes, noise)
  return nodes
}

function apply_noise_recursively(noise) {
  var nodes = this
    , first_node = parseInt(Math.random() * nodes.length)
    , nodes_visited = {}
    , iteration = 0

  function _again(node_neighbor) {
    var neighbors = nodes[node_neighbor].neighbors
      , elevation = ((noise.pink[iteration] + Math.abs(noise.min_pink)) / noise.pink_total) * 10
      , moisture = ((noise.blue[iteration] + Math.abs(noise.min_blue)) / noise.blue_total) * 100

    nodes[node_neighbor].position.y = elevation.round(3)
    nodes[node_neighbor].moisture = moisture.round(2)
    if (nodes[node_neighbor].moisture > 84) nodes[node_neighbor].water = true
    iteration++
    nodes_visited[node_neighbor] = true

    // repeat for neighbors of this node (which are NOT already visited !!)
    for (var i = 0, il = neighbors.length; i < il; i++) {
      if (! nodes_visited[neighbors[i]]) _again(neighbors[i])
    }
  }
  return _again(first_node)
}
