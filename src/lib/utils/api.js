import qs from 'qs';
import axios from 'axios';

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api`,
  paramsSerializer: params => qs.stringify(params, { arrayFormat: 'brackets' })
});

const get = (url, params = {}) => api.get(url, { params });

const post = (url, data, params = {}) => api.post(url, data, { params });

const put = (url, data, params = {}) => api.put(url, data, { params });

const del = (url, params = {}) => api.delete(url, { params });

api.interceptors.response.use(({ data }) => data);

const methods = {
  get,
  post,
  put,
  del
};

export default methods;
