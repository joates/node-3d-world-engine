module.exports = function(THREE) {
  return (function() {
    var Vertex = require('./Vertex_3d')(THREE)

    function Edge() {
      this.delaunay_neighbor = { region_id: null, edge_id: null }
      this.voronoi_verts = [ Vertex(), Vertex() ]
    }

    return new Edge()
  }())
}
