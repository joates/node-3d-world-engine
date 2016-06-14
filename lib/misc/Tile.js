;'use strict'
exports.get = get_tile

var o_o = require('./constants')      // @TODO: better name than 'o_o' !!
  , tile_size = o_o.map_tile.size
  , async = require('async')
  , LRU = require('lru-cache')
  , map_tile_cache = LRU({ max: o_o.cache.max })
  , level = require('levelup')
  , sublevel = require('level-sublevel')
  , db = sublevel(level(o_o.db.path, o_o.db.options))
  , db_map_tile = db.sublevel('map_tile')

var THREE = require('n3d-threejs')
  , extend = require('util-extend')
  , PDS = require('poisson-disc-sampler')
  , Voronoi = require('voronoi')
  , Noise = require('./noise')
  , Region = require('./Region')
  , biomes = require('./biomes')

// fixes rounding of float values in javascript
Number.prototype.round = function(num_places) {
  return +(Math.round(this +'e+'+ num_places) +'e-'+ num_places)
}

// Constructor:
function Tile(x, y) {
  if (! (this instanceof Tile)) return new Tile(x, y)
  this.grid = { position: new THREE.Vector2(x, y) }
  this.size = new THREE.Vector2(tile_size, tile_size)
  this.key = encode_key(x, y)
  this.regions = []
  this.flags = { welded_edges: 0 }
  this.corners = {}
}

function get_tile(opts, cb) {
  return (function() {
    if (opts.length !== 2) cb('[Tile::get_tile] Error: exactly 2 parameters expected, got '+ opts.length)
    var grid_x = opts[0]
      , grid_y = opts[1]
      , key = encode_key(grid_x, grid_y)

    db_get_tile(key, function(err, tile_from_db) {
      if (err && err.notFound) {      // map tile for this location doesn't exist in storage !!
        // spawn a new map tile
        create_map_tile(grid_x, grid_y, function(err, map_tiles) {
          if (err) { cb(err); return }

          map_tile_cache.del(map_tiles[0].key)
          process.nextTick(function() {
            map_tile_cache.set(map_tiles[0].key, map_tiles[0])
            db_map_tile.put(map_tiles[0].key, map_tiles[0], function(err) {
              if (err) { cb(err); return }
            })
            console.log('   > new map tile stored:', map_tiles[0].key)
          })
          cb(null, map_tiles)
        })
        return
      }
      cb(null, [ tile_from_db ])
    })
  }())
}

function db_get_tile(key, cb) {
  // check the cache first
  var map_tile_from_cache = map_tile_cache.get(key)
  if (map_tile_from_cache) {
    console.log('     | using cached map tile:', key)
    cb(null, map_tile_from_cache)
    return
  } else {
    // fetch map tile from the database
    db_map_tile.get(key, function(err, db_map_tile) {
      if (err) { cb(err); return }
      // update the cache
      map_tile_cache.set(db_map_tile.key, db_map_tile)
      cb(null, db_map_tile)
    })
  }
}

function create_map_tile(grid_x, grid_y, cb) {
  var start_time = Date.now()
    , tile = Tile(grid_x, grid_y)
    , points = generate_sample_points()
    , voronoi_cells = build_voronoi_cells(tile_size, points)

  var rot = calculate_tile_rotation()
  tile.rotation = rot.angle

  tile.regions = build_regions_from_voronoi_data(voronoi_cells, rot)
  add_noise.call(tile.regions)      // aka terraform

  if (grid_x !== -1 && grid_y !== -1) {
    repair_regions.call(tile, function(err, modified_tiles) {
      if (err) { cb(err); return }

      // build tile geometry from regions
      modified_tiles.forEach(function(mod_tile, mod_tile_id) {
        mod_tile.mesh_data = mod_tile.regions.map(function(region) { return Region.get_geometry(region) })
        // Optional: display map tile boundary
        if (mod_tile.key === '00001_00001' && mod_tile_id === 2) mod_tile.mesh_data.push(require('./Geometry').outline(tile))
      })
      tile.exec_time = Date.now() - start_time
      cb(null, modified_tiles)
    })
  }

  else {
    tile.mesh_data = tile.regions.map(function(region) { return Region.get_geometry(region) })
    tile.exec_time = Date.now() - start_time
    cb(null, [ tile ])
  }
}

function repair_regions(cb) {
  var tile = this

  build_quad_tile(tile, function(err, quad_tile, all_tiles) {
    if (err) { cb(err); return }

    var weld = {}
      , voronoi_cells = build_voronoi_cells(tile_size*2, quad_tile)
    weld.regions = build_regions_from_voronoi_data(voronoi_cells, false)

    weld.map = new Array(4)
    quad_tile.forEach(function(quad_cell) {
      if (! weld.map[quad_cell.tile]) weld.map[quad_cell.tile] = { orig_quad: {}, quad_orig: {} }
      weld.map[quad_cell.tile].orig_quad[quad_cell.original_voronoiId] = quad_cell.voronoiId
      weld.map[quad_cell.tile].quad_orig[quad_cell.voronoiId] = quad_cell.original_voronoiId
    })

    all_tiles.forEach(function(map_tile, map_tile_id) {
      var opts = setup_edge_repair(map_tile_id)

      // perform map tile boundary repairs
      map_tile.regions.forEach(function(region, region_id) {
        var is_welded = (region.flags.type & o_o.region.WELDED)

        if (! is_welded) {

          var corner_id = is_corner(region)
            , edge_id = locate_edge(region)

          // check for a corner location
          if (corner_id) {
            if (! (region.flags.type & o_o.region.CORNER))
              region.flags.type += o_o.region.CORNER
            map_tile.corners[corner_id] = region_id
            if (opts.excluded_corners.indexOf(corner_id) !== -1) return
          }

          // does this region's location fit the criteria to be 'welded' ??
          if (edge_id === undefined || opts.excluded_edges.indexOf(edge_id) === -1) {
            region = rebuild_geometry(region, weld.regions[weld.map[map_tile_id].orig_quad[region_id]], opts.offset)
            all_tiles[map_tile_id].regions[region_id] = encode_neighbors(region, region_id, map_tile_id, map_tile.key, all_tiles, weld)
          }
        }

      })

      // update the welded edge flags
      var horizontal_edge = opts.excluded_edges[0] === 'NORTH' ? 'SOUTH' : 'NORTH'
      if (! (map_tile.flags.welded_edges & o_o.edge[horizontal_edge]))
        all_tiles[map_tile_id].flags.welded_edges += o_o.edge[horizontal_edge]

      var vertical_edge = opts.excluded_edges[1] === 'WEST' ? 'EAST' : 'WEST'
      if (! (map_tile.flags.welded_edges & o_o.edge[vertical_edge]))
        all_tiles[map_tile_id].flags.welded_edges += o_o.edge[vertical_edge]

    })
    encode_edges.call(all_tiles)

    all_tiles.forEach(function(map_tile, map_tile_id) {
      // store modified map tiles
      map_tile_cache.del(map_tile.key)
      process.nextTick(function() {
        map_tile_cache.set(all_tiles[map_tile_id].key, all_tiles[map_tile_id])
        db_map_tile.put(all_tiles[map_tile_id].key, all_tiles[map_tile_id], function(err) {
          if (err) { cb(err); return }
        })
        console.log('   > modified map tile stored:', all_tiles[map_tile_id].grid.position)
      })
    })

    cb(null, all_tiles)
  })
}

function encode_neighbors(region, region_id, map_tile_id, map_tile_key, all_tiles, weld) {
  var is_boundary = (region.flags.type & o_o.region.BOUNDARY)

  if (! is_boundary) {
    if (Array.isArray(region.neighbors)) {
      var neighbors = {}
      neighbors[map_tile_key] = region.neighbors
      region.neighbors = neighbors

      region.edges.forEach(function(edge, edge_id) {
        if (typeof edge.delaunay_neighbor === 'number') {
          if (weld.map[map_tile_id].quad_orig[edge.delaunay_neighbor] !== undefined)
            edge.delaunay_neighbor = map_tile_key +'_'+ weld.map[map_tile_id].quad_orig[edge.delaunay_neighbor]

// DEBUG:
          else {
            console.error('encode_neighbors >> delaunay_neighbor missing from weld.map:'
              , 'id:', map_tile_id
              , 'key:', map_tile_key
              , 'neighbor:', edge.delaunay_neighbor
              , '\ndebug:', JSON.stringify(weld.map[map_tile_id].quad_orig, '\n')
            )
          }
//
        }
      })
    }
  }

  else {
    var target_region_id = weld.map[map_tile_id].orig_quad[region_id]
      , repaired_neighbors = {}
      , edge_map = {}

    region.edges.forEach(function(edge, edge_id) {
      edge_map[edge.delaunay_neighbor] = edge_id
    })

    weld.regions[target_region_id].neighbors.forEach(function(target_neighbor_id) {
      var pos = weld.regions[target_neighbor_id].center.position
        , delaunay_neighbor = region.edges[edge_map[target_neighbor_id]].delaunay_neighbor

      // Note: location of this neighbor identifies which map tile it belongs to
      if (pos.x > tile_size && pos.z < tile_size) {
        if (! repaired_neighbors[all_tiles[0].key]) repaired_neighbors[all_tiles[0].key] = []
        repaired_neighbors[all_tiles[0].key].push(weld.map[0].quad_orig[target_neighbor_id])
        if (typeof delaunay_neighbor === 'number') {
          if (weld.map[0].quad_orig[target_neighbor_id] !== undefined) {
            region.edges[edge_map[target_neighbor_id]].delaunay_neighbor = all_tiles[0].key +'_'+ weld.map[0].quad_orig[target_neighbor_id]
          }
        }
      }

      else if (pos.x > tile_size && pos.z > tile_size) {
        if (! repaired_neighbors[all_tiles[1].key]) repaired_neighbors[all_tiles[1].key] = []
        repaired_neighbors[all_tiles[1].key].push(weld.map[1].quad_orig[target_neighbor_id])
        if (typeof delaunay_neighbor === 'number') {
          if (weld.map[1].quad_orig[target_neighbor_id] !== undefined) {
            region.edges[edge_map[target_neighbor_id]].delaunay_neighbor = all_tiles[1].key +'_'+ weld.map[1].quad_orig[target_neighbor_id]
          }
        }
      }

      else if (pos.x < tile_size && pos.z > tile_size) {
        if (! repaired_neighbors[all_tiles[2].key]) repaired_neighbors[all_tiles[2].key] = []
        repaired_neighbors[all_tiles[2].key].push(weld.map[2].quad_orig[target_neighbor_id])
        if (typeof delaunay_neighbor === 'number') {
          if (weld.map[2].quad_orig[target_neighbor_id] !== undefined) {
            region.edges[edge_map[target_neighbor_id]].delaunay_neighbor = all_tiles[2].key +'_'+ weld.map[2].quad_orig[target_neighbor_id]
          }
        }
      }

      else if (pos.x < tile_size && pos.z < tile_size) {
        if (! repaired_neighbors[all_tiles[3].key]) repaired_neighbors[all_tiles[3].key] = []
        repaired_neighbors[all_tiles[3].key].push(weld.map[3].quad_orig[target_neighbor_id])
        if (typeof delaunay_neighbor === 'number') {
          if (weld.map[3].quad_orig[target_neighbor_id] !== undefined) {
            region.edges[edge_map[target_neighbor_id]].delaunay_neighbor = all_tiles[3].key +'_'+ weld.map[3].quad_orig[target_neighbor_id]
          }
        }
      }

    })
  }
  region.neighbors = deep_copy(repaired_neighbors)
  return region
}

function encode_edges() {
  var all_tiles = this
    , all_keys = all_tiles.map(function(tile) { return tile.key })

  for (var k = 0, kl = all_tiles.length; k < kl; k++) {
    for (var j = 0, jl = all_tiles[k].regions.length; j < jl; j++) {
      var region = all_tiles[k].regions[j]
        , is_boundary = (region.flags.type & o_o.region.BOUNDARY)
        , is_welded = (region.flags.type & o_o.region.WELDED)

      var orig_tile_id = k
        , orig_tile_key = all_tiles[k].key
        , orig_region_id = j

      if (is_boundary && is_welded) {
        // traverse edges
        for (var i = 0, il = region.edges.length; i < il; i++) {
          var neighbor = region.edges[i].delaunay_neighbor
          if (typeof neighbor === 'string') {
            var target_tile_key = neighbor.substr(0, 11)
            var target_tile_id  = all_keys.indexOf(target_tile_key)
            if (target_tile_id !== -1) {
              var target_region_id = parseInt(neighbor.substr(12))
                , neighbor_edge_id = get_delaunay_neighbors_edge_id(orig_tile_key, orig_region_id, all_tiles[target_tile_id], target_region_id)
              if (neighbor_edge_id !== undefined)
                all_tiles[k].regions[j].edges[i].delaunay_neighbors_edge_id = neighbor_edge_id
            }
          }
        }
      }

      else if (! is_boundary && is_welded) {
        for (var i = 0, il = region.edges.length; i < il; i++) {
          var neighbor = region.edges[i].delaunay_neighbor
          if (typeof neighbor === 'string') {
            var target_region_id = parseInt(neighbor.substr(12))
              , neighbor_edge_id = get_delaunay_neighbors_edge_id(orig_tile_key, orig_region_id, all_tiles[k], target_region_id)
            if (neighbor_edge_id !== undefined)
              all_tiles[k].regions[j].edges[i].delaunay_neighbors_edge_id = neighbor_edge_id
          }
        }
      }
    }
  }

}

function get_delaunay_neighbors_edge_id(orig_tile_key, orig_region_id, target_map_tile, target_region_id) {
  if (Number.isNaN(target_region_id)) return
  else {
    for (var i = 0, il = target_map_tile.regions[target_region_id].edges.length; i < il; i++) {
      var id = target_map_tile.regions[target_region_id].edges[i].delaunay_neighbor
      if (typeof id === 'string') {
        if ( (id.substr(0, 11) === orig_tile_key)
          && (parseInt(id.substr(12)) === orig_region_id) ) return i
      }
    }
  }
  return
}

function rebuild_geometry(region, welded_region, offset) {
  if (region.flags.type & o_o.region.WELDED)
    return region

  // preserve original state
  var center = region.center
    , elevation = region.elevation
    , moisture = region.moisture
    , neighbors = region.neighbors
    , flags = region.flags
    , biome = region.biome

  region = deep_copy(welded_region)
  region.quad_tile_neighbors = deep_copy(region.neighbors)

  // restore original state
  region.center = center
  region.elevation = elevation
  region.moisture = moisture
  region.neighbors = neighbors
  region.flags = flags
  region.biome = biome

  // apply offsets to vertex locations
  for (var i = 0, il = region.vertices.length; i < il; i++) {
    region.vertices[i].x += offset.x
    region.vertices[i].z += offset.z
  }

  // set as repaired
  region.flags.type += o_o.region.WELDED
  return region
}

function setup_edge_repair(tile_id) {
  var opts = {
      offset: { x: 0, z: 0 }
    , excluded_edges: []
    , excluded_corners: []
  }

  switch(tile_id) {
    case 0:       // North-East location of quad_tile
      opts.offset.x = tile_size * -1
      opts.excluded_edges.push( 'NORTH',  'EAST')
      opts.excluded_corners.push('NORTH_WEST', 'SOUTH_EAST')
      break
    case 1:       // South-East location of quad_tile
      opts.offset.x = tile_size * -1
      opts.offset.z = tile_size * -1
      opts.excluded_edges.push( 'SOUTH',  'EAST')
      opts.excluded_corners.push('NORTH_EAST', 'SOUTH_WEST')
      break
    case 2:       // South-West location of quad_tile
      opts.offset.z = tile_size * -1
      opts.excluded_edges.push( 'SOUTH',  'WEST')
      opts.excluded_corners.push('NORTH_WEST', 'SOUTH_EAST')
      break
    case 3:       // North-West location of quad_tile
      opts.excluded_edges.push( 'NORTH',  'WEST')
      opts.excluded_corners.push('NORTH_EAST', 'SOUTH_WEST')
      break
    default:
  }
  return opts
}

function locate_edge(region) {
  var edge_id
    , edge_min = o_o.edge._MIN
    , edge_max = o_o.edge._MAX

  region.vertices.forEach(function(vert) {
    if (vert.x < edge_min) edge_id = 'WEST'
    else if (vert.x > edge_max) edge_id = 'EAST'
    else if (vert.z < edge_min) edge_id = 'NORTH'
    else if (vert.z > edge_max) edge_id = 'SOUTH'
  })
  return edge_id
}

function is_corner(region) {
  var corner_id
    , edge_min = o_o.edge._MIN
    , edge_max = o_o.edge._MAX

  region.vertices.forEach(function(vert) {
    if (vert.x < edge_min && vert.z < edge_min) corner_id = 'NORTH_WEST'
    else if (vert.x > edge_max && vert.z < edge_min) corner_id = 'NORTH_EAST'
    else if (vert.x < edge_min && vert.z > edge_max) corner_id = 'SOUTH_WEST'
    else if (vert.x > edge_max && vert.z > edge_max) corner_id = 'SOUTH_EAST'
  })
  return corner_id || false
}

function deep_copy(obj) {
  var copy = obj
    , k
  if (obj && typeof obj === 'object') {
    copy = Object.prototype.toString.call(obj) === '[object Array]' ? [] : {}
    for (k in obj) {
      copy[k] = deep_copy(obj[k])
    }
  }
  return copy
}

function build_quad_tile(tile, cb) {
  var grid_pos = tile.grid.position
    , tile_key_SE = encode_key(grid_pos.x, grid_pos.y - 1)
    , tile_key_SW = encode_key(grid_pos.x - 1, grid_pos.y - 1)
    , tile_key_NW = encode_key(grid_pos.x - 1, grid_pos.y)

  async.series([
        function(db_cb) { db_get_tile(tile_key_SE, db_cb) }
      , function(db_cb) { db_get_tile(tile_key_SW, db_cb) }
      , function(db_cb) { db_get_tile(tile_key_NW, db_cb) }
    ]
  , function(err, db_tiles) {
    if (err) { cb(err); return }
    var quad_tile = []

    // build the quad tile
    db_tiles.forEach(function(db_tile, db_tile_id) {
      db_tile.regions.forEach(function(region, region_id) {
        var pos = region.center.position
          , pos_x
          , pos_y
        switch (db_tile_id) {
          case 0:
            pos_x = tile_size+pos.x; pos_y = tile_size+pos.z   // South East quadrant
            break
          case 1:
            pos_x = pos.x; pos_y = tile_size+pos.z             // South West quadrant
            break
          case 2:
            pos_x = pos.x; pos_y = pos.z                       // North West quadrant
            break
          default:
        }
        quad_tile.push({ x: pos_x, y: pos_y, tile: db_tile_id + 1, original_voronoiId: region_id })
      })
    })
    tile.regions.forEach(function(region, region_id) {         // North East quadrant
      var pos = region.center.position
      quad_tile.push({ x: tile_size+pos.x, y: pos.z, tile: 0, original_voronoiId: region_id })
    })

    var all_tiles = [ tile, db_tiles[0], db_tiles[1], db_tiles[2] ]
    cb(null, quad_tile, all_tiles)
  })
}

function generate_sample_points() {
  var min_dist = o_o.region.min_distance
    , sampler = PDS(tile_size - min_dist, tile_size - min_dist, min_dist)
    , points = []

  while ((sample = sampler())) {
    var sx = sample[0] + min_dist*0.5
      , sy = sample[1] + min_dist*0.5
    points.push({ x: sx, y: sy })
  }
  return points
}

function build_voronoi_cells(bbox_size, points) {
  var voronoi = new Voronoi()
    , bbox = { xl: 0, xr: bbox_size, yt: 0, yb: bbox_size }
  return voronoi.compute(points, bbox)
}

function encode_key(x, y) {
  var key_depth = o_o.map_tile.key_depth
    , key_x = Array(Math.max(key_depth - String(++x).length+1, 0)).join(0) + x
    , key_y = Array(Math.max(key_depth - String(++y).length+1, 0)).join(0) + y
  return (key_x +'_'+ key_y)
}

function calculate_tile_rotation() {
  var rot = parseInt(Math.random() * 4)     // range 0 ... 3
    , theta = rot * Math.PI * 0.5           // angle of rotation is either 90, 180 or 270
  rot = rot === 2 ? 0 : rot                 // 180 degree rotation is not useful, so discard it here
  return { angle:rot*90, ct: Math.cos(theta), st: Math.sin(theta) }
}

function build_regions_from_voronoi_data(voronoi, rotation) {
  // build a structure containing all region info (verts, edges, neighbors)
  var regions = new Array(voronoi.cells.length)
  voronoi.cells.forEach(function(from_cell) {
    var site_id = from_cell.site.voronoiId
    regions[site_id] = (rotation && rotation.angle) ? Region.create(from_cell) : Region.create(from_cell, rotation)
  })
  return regions
}

// @TODO: maybe this section can be moved into lib/misc/Noise.js !!
function add_noise() {
  var regions = this
    , min_dist = o_o.region.min_distance

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
    var dist_x = regions[i].center.position.x - tile_size * 0.5
      , dist_y = regions[i].center.position.z - tile_size * 0.5
      , near_center = Math.sqrt(dist_x * dist_x + dist_y * dist_y) < min_dist * 1.5
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
      , elevation = ((noise.pink[iteration] + Math.abs(pink_bounds.min)) / noise.totals.pink)
      , moisture  = ((noise.blue[iteration] + Math.abs(blue_bounds.min)) / noise.totals.blue)

    // set biome info
    var biome = biomes[parseInt(elevation*3)][parseInt(moisture*5)]
    regions[delaunay_neighbor].biome.type  = biome.type
    regions[delaunay_neighbor].biome.color = biome.color

    regions[delaunay_neighbor].elevation = (elevation*10).round(3)
    regions[delaunay_neighbor].moisture  = (moisture*100).round(2)
    iteration++
    regions_visited[delaunay_neighbor] = true

    // repeat for neighbors of this node (which are NOT already visited !!)
    for (var i = 0, il = neighbors.length; i < il; i++) {
      if (! regions_visited[neighbors[i]]) apply_noise(neighbors[i])
    }
  }
  return apply_noise(noise.starting_node)
}
