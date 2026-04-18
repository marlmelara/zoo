import api from '../lib/api';

export const getAnimals       = ()     => api.get('/animals');
export const getAnimalById    = (id)   => api.get(`/animals/${id}`);
export const getAnimalZones   = ()     => api.get('/animals/zones/all');
export const createAnimal     = (body) => api.post('/animals', body);
export const updateAnimal     = (id, b) => api.patch(`/animals/${id}`, b);
export const assignVetToAnimal     = (id, b) => api.post(`/animals/${id}/vet-assign`, b);
export const assignCaretakerToAnimal = (id, b) => api.post(`/animals/${id}/caretaker-assign`, b);
export const addMedicalHistory = (id, b) => api.post(`/animals/${id}/medical-history`, b);

// Medical & care log fetches + updates
export const getMedicalHistory = (id)        => api.get(`/animals/${id}/medical-history`);
export const getCareLog        = (id)        => api.get(`/animals/${id}/care-log`);
export const addCareLog        = (id, body)  => api.post(`/animals/${id}/care-log`, body);
export const setHealthStatus   = (id, health_status) =>
    api.patch(`/animals/${id}/health-status`, { health_status });
