import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

// attach token to every request if we have one
api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// venues
export const getVenues = () => api.get('/venues');
export const createVenue = (data) => api.post('/venues', data);
export const deleteVenue = (id) => api.delete(`/venues/${id}`);

// events
export const getEvents = (params) => api.get('/events', { params });
export const getEvent = (id) => api.get(`/events/${id}`);
export const getEventSeats = (id) => api.get(`/events/${id}/seats`);
export const createEvent = (data) => api.post('/events', data);
export const getEventSummary = (id) => api.get(`/events/${id}/summary`);

// bookings
export const holdSeats = (data) => api.post('/bookings/hold', data);
export const confirmBooking = (data) => api.post('/bookings/confirm', data);
export const getBookings = () => api.get('/bookings');
export const cancelBooking = (id) => api.post(`/bookings/${id}/cancel`);
export const releaseHold = (data) => api.post('/bookings/release', data);

// waitlist
export const joinWaitlist = (data) => api.post('/waitlist/join', data);
export const getWaitlistStatus = (eventId) => api.get(`/waitlist/status/${eventId}`);
export const acceptWaitlistOffer = (token) => api.post(`/waitlist/accept/${token}`);
export const getEventWaitlist = (eventId) => api.get(`/waitlist/event/${eventId}`);
export const leaveWaitlist = (id) => api.delete(`/waitlist/${id}`);

export default api;
