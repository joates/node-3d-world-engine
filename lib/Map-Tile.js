;"use strict"

var map_size = 256
  , min_distance = 10
  , Nodes = require('./Nodes')()

// fixes rounding of float values in javascript
Number.prototype.round = function(num_places) {
  return +(Math.round(this +'e+'+ num_places) +'e-'+ num_places)
}

function Tile(x, y) {
  // default properties
  this.size = { x: map_size, y: map_size }
  this.position = { x: x, y: y }

  var start_time = Date.now()
    , samples  = Nodes.create(map_size, min_distance)
    , _tile = Nodes.create_regions(samples, map_size)

  this.nodes = Nodes.terraform(_tile.nodes)
  this.regions = _tile.regions
  this.exec_time = Date.now() - start_time
  return this
}

exports.create = function(x, y) {
  return new Tile(x, y)
}