const getRatingStatusIcon = status => {
  const icons = {
    heroTop5: '🀄',
    heroTop10: '🎴',
    heroTop25: '🎗',
    clanTop5: '🏵'
  };

  return icons[status] || '';
};

const getRatingStatusData = (tx, league, status) => {
  const labels = {
    maximus: {
      heroTop5: tx.labelMaximusTop5,
      heroTop10: tx.labelMaximusTop10,
      heroTop25: tx.labelMaximusTop25,
      clanTop5: tx.labelMaximusClanTop5
    }
  };

  const label = labels[league][status];

  return label
    ? { icon: getRatingStatusIcon(status), label }
    : { icon: '', label: tx.labelNoStatus };
};

const calculateGlobalRating = stats => {
  const { level, wins, loses, draws } = stats;
  const totalFights = wins + loses + draws;
  const balancer = 100;
  const winrate =
    (wins - loses + 1) / (wins + loses) + draws / (2 * totalFights);

  return Math.round((level / 2) * winrate * balancer);
};

module.exports = {
  getRatingStatusData,
  getRatingStatusIcon,
  calculateGlobalRating
};
