export const get = key => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : value;
  } catch (err) {
    console.warn(`localStorage.get ${key} error`);
  }
};

export const set = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage.set ${key} error`);
  }
};

export const remove = key => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`localStorage.remove ${key} error`);
  }
};

const storage = {
  get,
  set,
  remove
};

export default storage;
