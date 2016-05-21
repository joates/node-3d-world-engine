;"use strict"

exports.render = render_tile
var biomes = require('./biomes')
  , map_floor = 0

function render_tile(tile, THREE) {
  return (function() {
    var offset = { x: tile.size.x * -0.5, y: tile.size.y * -0.5 }
      , grid_x =  tile.grid.position.x
      , grid_y = -tile.grid.position.y      // Note: tile grid position on y-axis is flipped !!
      , tile_offset = { x: grid_x * tile.size.x + offset.x, z: grid_y * tile.size.y + offset.y }
      , boundary_line_mat = new THREE.LineBasicMaterial({ color: 0x606060, linewidth: 1.5 })
      , normal = new THREE.Vector3(0, 1, 0)
      , tile_object = new THREE.Object3D()

    // tile outline
    // var bbox = [ [0, 1, 0], [256, 1, 0], [256, 1, 256], [0, 1, 256], [0, 1, 0] ]
    // for (var i = 0, il = bbox.length - 1; i<il; i++) {
    //   var v1 = bbox[i]
    //     , v2 = bbox[i+1]
    //   geo = new THREE.Geometry()
    //   geo.vertices.push(
    //       new THREE.Vector3(v1[0] + tile_offset.x, v1[1], v1[2] + tile_offset.z)
    //     , new THREE.Vector3(v2[0] + tile_offset.x, v2[1], v2[2] + tile_offset.z)
    //   )
    //   line = new THREE.Line(geo, boundary_line_mat)
    //   tile_object.add(line)
    // }

    tile.regions.forEach(function(region, id) {

      var origin = new THREE.Vector3(region.center.position.x + tile_offset.x, map_floor, region.center.position.z + tile_offset.z)
        , num_verts = 0

      if (region.boundary && (! region.welded)) {

        // show boundary regions (as only outlines)
        region.edges.forEach(function(edge) {
          var geo = new THREE.Geometry()
          geo.vertices.push(
              new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset.x, map_floor, region.vertices[edge.voronoi_verts[0]].z + tile_offset.z)
            , new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset.x, map_floor, region.vertices[edge.voronoi_verts[1]].z + tile_offset.z)
          )
          var line = new THREE.Line(geo, boundary_line_mat)
          tile_object.add(line)
        })

      } else {

        // render and assign a biome to each region
        var poly_geo = new THREE.Geometry()
          , outlines = []
          , next_to_water = false

        region.edges.forEach(function(edge) {

          // test for nearby water
          // if (! region.water) {
          //   var neighbor = tile.regions[edge.delaunay_neighbor]
          //   if (neighbor.water)
          //     next_to_water = true
          // }

          // define the geometry for this region
          var v1  = new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset.x, map_floor, region.vertices[edge.voronoi_verts[0]].z + tile_offset.z)
            , v2  = new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset.x, map_floor, region.vertices[edge.voronoi_verts[1]].z + tile_offset.z)
          poly_geo.vertices.push(origin, v1, v2)
          poly_geo.faces.push(new THREE.Face3(num_verts, num_verts + 1, num_verts + 2))
          num_verts += 3

          // outline this region
          // var line_geo = new THREE.Geometry()
          // line_geo.vertices.push(
          //     new THREE.Vector3(region.vertices[edge.voronoi_verts[0]].x + tile_offset.x, 1.1, region.vertices[edge.voronoi_verts[0]].z + tile_offset.z)
          //   , new THREE.Vector3(region.vertices[edge.voronoi_verts[1]].x + tile_offset.x, 1.1, region.vertices[edge.voronoi_verts[1]].z + tile_offset.z)
          // )
          // outlines.push(new THREE.Line(line_geo, line_mat))

        })

        // render outlined polygons (i.e. welded edges)
        //for (var o = 0, ol = outlines.length; o < ol; o++) tile_object.add(outlines[o])

        // calculate biome for this region
        var color = new THREE.Color()
          , elevation = parseInt(tile.regions[id].center.position.y / 10 * 3)
          , moisture  = parseInt(tile.regions[id].moisture / 100 * 5)
        color.set(parseInt(biomes[elevation][moisture]), 16)

        // add color for water-filled regions
        // if (region.water) color.set(0x0000f8)
        // else if (region.moisture > 70 && next_to_water) color.set(0x4F86F7)

        // render filled polygon
        var poly_mat = new THREE.MeshBasicMaterial({ color: color })
        var poly = new THREE.Mesh(poly_geo, poly_mat)
        tile_object.add(poly)
      }
    })

    return tile_object
  })()
}
