import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { User, Stethoscope, Briefcase, Shield } from 'lucide-react';

export default function Staff() {
    const { role } = useAuth();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    // Add Staff State
    const [showForm, setShowForm] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', contact_info: '', pay_rate_cents: '', shift_timeframe: '', dept_id: '',
        // Role specific
        license_no: '', specialty: '', // Vet
        specialization_species: '', // Caretaker
        office_location: '' // Manager
    });

    useEffect(() => {
        fetchStaff();
        fetchDepartments();
    }, []);

    async function fetchStaff() {
        try {
            // Fetch employees with their department and join with role tables
            // Supabase basic joining is a bit different, we'll fetch base employees + depts first
            const { data: employees, error } = await supabase
                .from('employees')
                .select(`
          *,
          departments!employees_dept_id_fkey (dept_name),
          vets (license_no, specialty),
          animal_caretakers (specialization_species),
          managers (office_location)
        `);

            if (error) throw error;
            setStaff(employees || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchDepartments() {
        const { data } = await supabase.from('departments').select('*');
        if (data) setDepartments(data);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            // 1. Insert Employee
            const { data: emp, error: empError } = await supabase.from('employees').insert([{
                first_name: formData.first_name,
                last_name: formData.last_name,
                contact_info: formData.contact_info,
                pay_rate_cents: parseInt(formData.pay_rate_cents) * 100, // Input as dollars
                shift_timeframe: formData.shift_timeframe,
                dept_id: formData.dept_id
            }]).select().single();

            if (empError) throw empError;

            // 2. Insert Role Specifics
            const selectedDept = departments.find(d => d.dept_id == formData.dept_id);
            if (selectedDept) {
                const deptName = selectedDept.dept_name.toLowerCase();
                let roleError;

                if (deptName.includes('vet')) {
                    const { error } = await supabase.from('vets').insert([{
                        employee_id: emp.employee_id,
                        license_no: formData.license_no,
                        specialty: formData.specialty
                    }]);
                    roleError = error;
                } else if (deptName.includes('admin') || deptName.includes('manager')) {
                    const { error } = await supabase.from('managers').insert([{
                        employee_id: emp.employee_id,
                        office_location: formData.office_location
                    }]);
                    roleError = error;
                } else if (deptName.includes('care') || deptName.includes('keeper') || deptName.includes('animal')) {
                    const { error } = await supabase.from('animal_caretakers').insert([{
                        employee_id: emp.employee_id,
                        specialization_species: formData.specialization_species
                    }]);
                    roleError = error;
                }
                if (roleError) throw roleError;
            }

            setShowForm(false);
            setFormData({
                first_name: '', last_name: '', contact_info: '', pay_rate_cents: '', shift_timeframe: '', dept_id: '',
                license_no: '', specialty: '', specialization_species: '', office_location: ''
            });
            fetchStaff();

        } catch (error) {
            console.error('Error adding staff:', error);
            alert('Failed to add staff: ' + error.message);
        }
    }

    const getRoleIcon = (deptName) => {
        switch (deptName) {
            case 'Veterinary Services': return <Stethoscope size={20} color="var(--color-primary)" />;
            case 'Administration': return <Briefcase size={20} color="var(--color-secondary)" />;
            case 'Security': return <Shield size={20} color="var(--color-accent)" />;
            default: return <User size={20} color="var(--color-text-muted)" />;
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredStaff = staff.filter(person =>
        person.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.departments?.dept_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Staff Management</h1>
                    <input
                        type="text"
                        placeholder="Search staff..."
                        className="glass-input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {(role === 'admin' || role === 'manager') && (
                    <button
                        className="glass-button"
                        onClick={() => setShowForm(!showForm)}
                        style={{ background: showForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                    >
                        {showForm ? 'Cancel' : '+ Add Staff'}
                    </button>
                )}
            </div>

            {
                showForm && (
                    <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', border: '1px solid var(--color-secondary)' }}>
                        <h3>New Staff Member</h3>
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <input placeholder="First Name" required className="glass-input" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                            <input placeholder="Last Name" required className="glass-input" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                            <input placeholder="Contact Info" className="glass-input" value={formData.contact_info} onChange={e => setFormData({ ...formData, contact_info: e.target.value })} />
                            <input placeholder="Hourly Rate ($)" type="number" required className="glass-input" value={formData.pay_rate_cents} onChange={e => setFormData({ ...formData, pay_rate_cents: e.target.value })} />
                            <input placeholder="Shift Check (e.g. 9-5)" className="glass-input" value={formData.shift_timeframe} onChange={e => setFormData({ ...formData, shift_timeframe: e.target.value })} />

                            <select required className="glass-input" value={formData.dept_id} onChange={e => setFormData({ ...formData, dept_id: e.target.value })}>
                                <option value="">Select Department...</option>
                                {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                            </select>

                            {/* Dynamic Fields based on Dept */}
                            {departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('vet') && (
                                <>
                                    <input placeholder="License Number" required className="glass-input" value={formData.license_no} onChange={e => setFormData({ ...formData, license_no: e.target.value })} />
                                    <input placeholder="Specialty" className="glass-input" value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })} />
                                </>
                            )}
                            {departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('admin') && (
                                <input placeholder="Office Location" required className="glass-input" value={formData.office_location} onChange={e => setFormData({ ...formData, office_location: e.target.value })} />
                            )}
                            {(departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('care') || departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('animal')) && (
                                <input placeholder="Specialization (Species)" required className="glass-input" value={formData.specialization_species} onChange={e => setFormData({ ...formData, specialization_species: e.target.value })} />
                            )}

                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                                <button type="submit" className="glass-button" style={{ background: 'var(--color-secondary)', width: '100%' }}>Save Staff Member</button>
                            </div>
                        </form>
                    </div>
                )
            }

            {
                loading ? (
                    <p>Loading staff...</p>
                ) : (
                    <div className="grid-cards">
                        {filteredStaff.map(person => (
                            <div key={person.employee_id} className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px' }}>{person.first_name} {person.last_name}</h3>
                                        <span style={{
                                            fontSize: '12px',
                                            padding: '4px 8px',
                                            borderRadius: '20px',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'var(--color-text-muted)'
                                        }}>
                                            {person.departments?.dept_name || 'Unassigned'}
                                        </span>
                                    </div>
                                    {getRoleIcon(person.departments?.dept_name)}
                                </div>

                                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <p>Shift: {person.shift_timeframe}</p>

                                    {/* Role Specific Details */}
                                    {person.vets && (
                                        <div style={{ color: 'var(--color-primary)' }}>
                                            <p>Vet License: {person.vets.license_no}</p>
                                            <p>Specialty: {person.vets.specialty}</p>
                                        </div>
                                    )}
                                    {person.animal_caretakers && (
                                        <div style={{ color: 'var(--color-text)' }}>
                                            <p>Specialization: {person.animal_caretakers.specialization_species}</p>
                                        </div>
                                    )}
                                    {person.managers && (
                                        <p>Office: {person.managers.office_location}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}
