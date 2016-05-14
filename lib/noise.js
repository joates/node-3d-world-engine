;'use strict'

// adaptation of original code by amitp
// -> http://www.redblobgames.com/articles/noise/introduction.html#rainbow

module.exports = function(type, size) {
  type = type ||  -1
  size = size || 256

  var freq = Array.apply(null, Array(31)).map(function (_, i) { return i + 1 })
    , amps = []
    , samples = []
    , res = []

  for (var i = 0, il = freq.length; i < il; i++) {
    amps[i] = Math.pow(freq[i], type)
    samples[i] = noise(size, freq[i])
  }
  return (weighted_sum(amps, samples, size))
}

function noise(size, freq) {
  var phase = Math.random() * 2 * Math.PI
    , res = []

  for (var i = 0, il = size; i < il; i++) {
    res.push(Math.sin(2 * Math.PI * freq * i / size + phase))
  }
  return res
}

function weighted_sum(amps, samples, size) {
  var res = Array.apply(null, Array(size)).map(Number.prototype.valueOf, 0)

  for (var k = 0, kl = samples.length; k < kl; k++) {
    for (var x = 0, xl = size; x < xl; x++) {
      res[x] += amps[k] * samples[k][x]
    }
  }
  return res
}
