;'use strict'

// extracted from a tutorial published by amitp
// -> http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/#biomes

biomes = {
    snow: '0xf8f8f8'
  , bare:  '0xbbbbbb'
  , taiga:  '0xccd4bb'
  , tundra:   '0xddddbb'
  , scorched:   '0x999999'
  , shrubland:    '0xc4ccbb'
  , grassland:      '0xc4d4aa'
  , temperate_desert:  '0xe4e8ca'
  , subtropical_desert:  '0xe9ddc7'
  , tropical_rain_forest:  '0x9cbba9'
  , temperate_rain_forest:   '0xa4c4a8'
  , tropical_seasonal_forest:  '0xa9cca4'
  , temperate_deciduous_forest:  '0xb4c9a9'
}
Object.freeze(biomes)

var biomes_map = new Array(4)
for (var i = 0, il = biomes_map.length; i < il; i++) {
  biomes_map[i] = new Array(6)
}

biomes_map[3][5] = { type: 'snow', color: biomes.snow }
biomes_map[3][4] = { type: 'snow', color: biomes.snow }
biomes_map[3][3] = { type: 'snow', color: biomes.snow }
biomes_map[3][2] = { type: 'tundra', color: biomes.tundra }
biomes_map[3][1] = { type: 'bare', color: biomes.bare }
biomes_map[3][0] = { type: 'scorched', color: biomes.scorched }

biomes_map[2][5] = { type: 'taiga', color: biomes.taiga }
biomes_map[2][4] = { type: 'taiga', color: biomes.taiga }
biomes_map[2][3] = { type: 'shrubland', color: biomes.shrubland }
biomes_map[2][2] = { type: 'shrubland', color: biomes.shrubland }
biomes_map[2][1] = { type: 'temperate desert', color: biomes.temperate_desert }
biomes_map[2][0] = { type: 'temperate desert', color: biomes.temperate_desert }

biomes_map[1][5] = { type: 'temperate_rain_forest', color: biomes.temperate_rain_forest }
biomes_map[1][4] = { type: 'temperate_deciduous_forest', color: biomes.temperate_deciduous_forest }
biomes_map[1][3] = { type: 'temperate_deciduous_forest', color: biomes.temperate_deciduous_forest }
biomes_map[1][2] = { type: 'grassland', color: biomes.grassland }
biomes_map[1][1] = { type: 'grassland', color: biomes.grassland }
biomes_map[1][0] = { type: 'temperate desert', color: biomes.temperate_desert }

biomes_map[0][5] = { type: 'tropical rain forest', color: biomes.tropical_rain_forest }
biomes_map[0][4] = { type: 'tropical rain forest', color: biomes.tropical_rain_forest }
biomes_map[0][3] = { type: 'tropical seasonal forest', color: biomes.tropical_seasonal_forest }
biomes_map[0][2] = { type: 'tropical seasonal forest', color: biomes.tropical_seasonal_forest }
biomes_map[0][1] = { type: 'grassland', color: biomes.grassland }
biomes_map[0][0] = { type: 'subtropical desert', color: biomes.subtropical_desert }

module.exports = biomes_map
