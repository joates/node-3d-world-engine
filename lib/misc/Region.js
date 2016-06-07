;'use strict'
exports.create = create_region
exports.get_geometry = get_geometry

var THREE = require('n3d-threejs')
  , Geometry = require('./Geometry')
  , o_o = require('./constants')
  , tile_size = o_o.map_tile.size

// Constructor:
function Region(x, y, z) {
  if (! (this instanceof Region)) return new Region(x, y, z)
  this.edges = []
  this.vertices = []
  this.neighbors = []
  this.center = { position: new THREE.Vector3(x, y, z) }
  this.elevation = 0
  this.moisture = 0
  this.flags = { type: 0 }
  this.biome = {}
}

function get_geometry(region) {
  return (function() {

    if (! region.geometry) region.geometry = Geometry.build(region)
    if (region.biome.color)
      region.geometry[0].color = region.biome.color
    return region.geometry

  }())
}

function create_region(voronoi_cell, rotation) {
  return (function() {

    var site = voronoi_cell.site
      , site_id = site.voronoiId
      , verts = {}      // Note: starts as an object because need to filter out duplicate vertices
      , edges = []
      , neighbors = []

    var rotation_center = { x: tile_size*0.5, y: tile_size*0.5 }
      , pos

    if (rotation && rotation.angle) pos = rotate_around(rotation_center, new THREE.Vector2(site.x, site.y), rotation.ct, rotation.st)
    else pos = site
    var region = Region(pos.x, 0, pos.y)

    voronoi_cell.halfedges.forEach(function(half_edge) {
      var v1 = half_edge.edge.va
        , v2 = half_edge.edge.vb

      var key1 = ''+ v1.x +','+ v1.y
      if (rotation&& rotation.angle) pos = rotate_around(rotation_center, v1, rotation.ct, rotation.st)
      else pos = v1
      verts[key1] = { position: { x: pos.x, y: 0, z: pos.y } }

      var key2 = ''+ v2.x +','+ v2.y
      if (rotation && rotation.angle) pos = rotate_around(rotation_center, v2, rotation.ct, rotation.st)
      else pos = v2
      verts[key2] = { position: { x: pos.x, y: 0, z: pos.y } }

      if (half_edge.edge.rSite) {
        var lSite_id = half_edge.edge.lSite.voronoiId
          , rSite_id = half_edge.edge.rSite.voronoiId
        region.edges.push({ voronoi_verts: [ key1, key2 ], delaunay_neighbor: lSite_id === site_id ? rSite_id : lSite_id })
      } else {
        // mark as boundary
        if (! (region.flags.type & o_o.region.BOUNDARY))
          region.flags.type += o_o.region.BOUNDARY
      }

      // locate the neighbors of this region
      if (half_edge.edge.lSite && half_edge.edge.lSite.voronoiId !== site_id)
        region.neighbors.push(half_edge.edge.lSite.voronoiId)

      if (half_edge.edge.rSite && half_edge.edge.rSite.voronoiId !== site_id)
        region.neighbors.push(half_edge.edge.rSite.voronoiId)
    })

    // convert *only* the unique vertices into an array structure
    Object.keys(verts).forEach(function(key) {
      region.vertices.push(verts[key].position)
    })

    // store the edges
    for (var i = 0, il = region.edges.length; i < il; i++) {
      var vert_ids = []
      region.edges[i].voronoi_verts.forEach(function(vert) {
        // decode the voronoi-edge vertices
        Object.keys(verts).forEach(function(key, j) { if (key === vert) vert_ids.push(j) })
      })
      // use cross-product to calculate correct order of edge vertices
      var v1 = new THREE.Vector3().copy(region.vertices[vert_ids[0]])
        , v2 = new THREE.Vector3().copy(region.vertices[vert_ids[1]])
        , origin = new THREE.Vector3().copy(region.center.position)
        , cp = new THREE.Vector3().crossVectors(v1.sub(origin), v2.sub(origin))
      if (cp.y < 0) region.edges[i].voronoi_verts = [ vert_ids[1], vert_ids[0] ]
      else region.edges[i].voronoi_verts = [ vert_ids[0], vert_ids[1] ]
    }

    // Note: should delay building geometry until later.. just added here for debug !!
    //region.geometry = get_geometry(region)

    return region

  }())
}

function rotate_around(center, pos, ct, st) {
  var nx = (ct * (pos.x - center.x)) + (st * (pos.y - center.y)) + center.x
    , ny = (ct * (pos.y - center.y)) - (st * (pos.x - center.x)) + center.y
  return { x: nx, y: ny }
}
