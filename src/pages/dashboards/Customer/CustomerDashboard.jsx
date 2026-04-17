import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import ProfileTab from './tabs/ProfileTab';
import PurchasesTab from './tabs/PurchasesTab';
import TicketsTab from './tabs/TicketsTab';
import DonationsTab from './tabs/DonationsTab';
import EventsTab from './tabs/EventsTab';
import './CustomerDashboard.css';

const TABS = ['My Profile', 'My Purchases', 'My Tickets', 'My Donations', 'Events'];

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('My Profile');

  const isMembershipActive = profile?.membership_type && profile?.membership_end && new Date(profile.membership_end) >= new Date();

  const membershipColor = (type) => {
    switch (type) {
      case 'premium': return '#f59e0b';
      case 'family': return '#3b82f6';
      case 'explorer': return '#10b981';
      default: return 'var(--color-text-muted)';
    }
  };

  return (
    <div className="customer-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">My Account</h1>
          <p className="dashboard-subtitle">
            Welcome back{profile ? `, ${profile.first_name}` : ''}!
          </p>
        </div>
        {isMembershipActive && (
          <div className={`membership-badge ${profile.membership_type}`}>
            <Star size={16} />
            <span>{profile.membership_type} Member</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-button glass-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'My Profile' && <ProfileTab />}
      {activeTab === 'My Purchases' && <PurchasesTab />}
      {activeTab === 'My Tickets' && <TicketsTab />}
      {activeTab === 'My Donations' && <DonationsTab />}
      {activeTab === 'Events' && <EventsTab />}
    </div>
  );
}