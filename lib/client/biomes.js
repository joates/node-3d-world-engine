;'use strict'

// extracted from a tutorial published by amitp
// -> http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/#biomes

biomes = {
    snow: '0xf8f8f8'
  , tundra: '0xddddbb'
  , bare: '0xbbbbbb'
  , scorched: '0x999999'
  , taiga: '0xccd4bb'
  , shrubland: '0xc4ccbb'
  , temperate_desert: '0xe4e8ca'
  , temperate_rain_forest: '0xa4c4a8'
  , temperate_deciduous_forest: '0xb4c9a9'
  , grassland: '0xc4d4aa'
  , tropical_rain_forest: '0x9cbba9'
  , tropical_seasonal_forest: '0xa9cca4'
  , subtropical_desert: '0xe9ddc7'
}

Object.freeze(biomes)

var biomes_map = new Array(4)
for (var i = 0, il = biomes_map.length; i < il; i++) {
  biomes_map[i] = new Array(6)
}

biomes_map[3][5] = biomes.snow
biomes_map[3][4] = biomes.snow
biomes_map[3][3] = biomes.snow
biomes_map[3][2] = biomes.tundra
biomes_map[3][1] = biomes.bare
biomes_map[3][0] = biomes.scorched

biomes_map[2][5] = biomes.taiga
biomes_map[2][4] = biomes.taiga
biomes_map[2][3] = biomes.shrubland
biomes_map[2][2] = biomes.shrubland
biomes_map[2][1] = biomes.temperate_desert
biomes_map[2][0] = biomes.temperate_desert

biomes_map[1][5] = biomes.temperate_rain_forest
biomes_map[1][4] = biomes.temperate_deciduous_forest
biomes_map[1][3] = biomes.temperate_deciduous_forest
biomes_map[1][2] = biomes.grassland
biomes_map[1][1] = biomes.grassland
biomes_map[1][0] = biomes.temperate_desert

biomes_map[0][5] = biomes.tropical_rain_forest
biomes_map[0][4] = biomes.tropical_rain_forest
biomes_map[0][3] = biomes.tropical_seasonal_forest
biomes_map[0][2] = biomes.tropical_seasonal_forest
biomes_map[0][1] = biomes.grassland
biomes_map[0][0] = biomes.subtropical_desert

module.exports = biomes_map
