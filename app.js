;'use strict'

var http    = require('http')
  , express = require('express')
  , sio     = require('socket.io')
  , World   = require('./lib/server/World')()
  , app     = express()
  , port    = process.env.PORT || 8000

app.use(express.static(__dirname + '/public'))

var server = http.createServer(app).listen(port, function() {
  console.log('   Express server listening on port ' + port)
})

var io = sio(server)

io.sockets.on('connection', function(socket) {

  // new map tile requested
  socket.on('get_tile', function(x, y) {
    World.get('map_tile', [x, y], function(err, tile) {
      if (err) console.error('app::socket_get_tile::World.get ->', err)
      socket.emit('new_tile', tile)
    })
  })
})
