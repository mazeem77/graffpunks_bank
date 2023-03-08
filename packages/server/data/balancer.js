const criticalBalancer = Object.freeze({
  1: 100,
  2: 150,
  3: 200,
  4: 250,
  5: 300,
  6: 400,
  7: 450,
  8: 550,
  9: 600,
  10: 650,
  11: 700,
  12: 800,
  13: 800,
  14: 800,
  15: 800,
  16: 800,
  17: 800,
  18: 800,
  19: 800,
  20: 800
});

const dodgeBalancer = Object.freeze({
  1: 100,
  2: 150,
  3: 200,
  4: 250,
  5: 300,
  6: 350,
  7: 400,
  8: 500,
  9: 550,
  10: 650,
  11: 725,
  12: 800,
  13: 800,
  14: 800,
  15: 800,
  16: 800,
  17: 800,
  18: 800,
  19: 800,
  20: 800
});

const counterBalancer = Object.freeze({
  1: 100,
  2: 125,
  3: 140,
  4: 160,
  5: 175,
  6: 190,
  7: 200,
  8: 215,
  9: 230,
  10: 250,
  11: 250,
  12: 250,
  13: 250,
  14: 250,
  15: 250,
  16: 250,
  17: 250,
  18: 250,
  19: 250,
  20: 250
});

const powerBalancer = 200;

const convert = (value, balancer) => (value > 0 ? value / balancer : 0);

const dodge = (value, level) => convert(value, dodgeBalancer[level]);
const counter = (value, level) => convert(value, counterBalancer[level]);
const critical = (value, level) => convert(value, criticalBalancer[level]);
const power = value => convert(value, powerBalancer);

module.exports = {
  power,
  critical,
  dodge,
  counter
};
