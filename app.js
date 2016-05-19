;'use strict'

var http    = require('http')
  , express = require('express')
  , sio     = require('socket.io')
  , Tile    = require('./lib/Tile')
  , app     = express()
  , port    = process.env.PORT || 8000

var level = require('levelup')
  , opts = { valueEncoding: 'json' }
  , db = level('./db/tiles', opts)

app.use(express.static(__dirname + '/public'))

var server = http.createServer(app).listen(port, function() {
  console.log('   Express server listening on port ' + port)
})

var io = sio(server)

io.sockets.on('connection', function(socket) {

  // initial connection
  //socket.emit('map_tile', Tile.create(0, 0))

  // new map tile requested
  socket.on('get_map_tile', function(x, y) {
    var key = encode_key(x, y)

    // does this tile already exist in the database ?
    db.get(key, function(err, tile_from_db) {
      if (err) {
        if (err.notFound) {

          // nope... so we create a new one
          var tile = Tile.create(x, y)
          // and store it
          db.put(key, tile, function(err) {
            if (err) console.error('db write:', err)
            console.log('   > new map tile stored:', JSON.stringify(tile.grid.position))
          })

          socket.emit('map_tile', tile)
        }

        // other errors occur here
        else throw new Error(err, err.stack)
      }

      // we got a tile from the database
      socket.emit('map_tile', tile_from_db)
    })
  })
})

function encode_key(x, y) {
  return ('00000'+ ++x).slice(-5) +'_'+ ('00000'+ ++y).slice(-5)
}

function decode_key(key) {
  var parts = key.split('_')
  return { x: parseInt(parts[0]) - 1, y: parseInt(parts[1]) - 1 }
}
