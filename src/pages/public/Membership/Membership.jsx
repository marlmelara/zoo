import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaCheck, FaStar, FaUsers, FaParking, FaTicketAlt, FaGift } from 'react-icons/fa';
import logo from '../../../images/logo.png';
import './membership.css';
import { useZooCart } from '../../../components/ShopCart';

const plans = [
  { type: 'explorer', name: 'Explorer', price_cents: 8999, discount: 0.10, duration_days: 365, featured: false,
    description: 'Basic Member Tier',
    perks: ['Unlimited general admission', 'Free parking', '10% off gift shop'] },
  { type: 'family', name: 'Family', price_cents: 14999, discount: 0.15, duration_days: 365, featured: true,
    description: 'Moderate Member Tier',
    perks: ['Everything in Explorer', '15% off gift shop'] },
  { type: 'premium', name: 'Premium', price_cents: 24999, discount: 0.20, duration_days: 365, featured: false,
    description: 'Best Member Tier',
    perks: ['Everything in Family', '20% off gift shop'] },
];

export default function Membership() {
  const navigate = useNavigate();
  const cartHook = useZooCart();

  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem('selectedMembership');
    return saved ? JSON.parse(saved).type : null;
  });

  useEffect(() => {
    if (cartHook.cart.membership?.plan_name) {
      setSelected(cartHook.cart.membership.plan_name);
    }
  }, [cartHook.cart.membership]);

  useEffect(() => {
    if (!cartHook.cart.membership && !localStorage.getItem('selectedMembership')) {
      setSelected(null);
    }
  }, [cartHook.cart.membership]);

  const handleChoosePlan = (plan) => {
    localStorage.setItem('selectedMembership', JSON.stringify(plan));
    cartHook.setMembership({
      plan_name: plan.type,
      price_cents: plan.price_cents,
      discount_rate: plan.discount,
      duration_days: plan.duration_days,
    });
    setSelected(plan.type);
  };

  const handleSignUp = () => {
    navigate('/tickets');
  };

  document.title = 'Memberships - Coog Zoo';

  return (
    <div className="membership-page">
      <div className="membership-container">

        {/* Header */}
        <h2 className="page-title" style={{ textAlign: 'center' ,  gap: '8px'}}>Memberships</h2>
        <p className="page-description" style={{ textAlign: 'center', width: '450px', margin: '0 auto' ,  gap: '16px' }}>
          Become a Coog Zoo member today and enjoy 12 months of wildlife fun, along with member exclusive discounts and benefits!
        </p>

        <Link to="/" style={{ position: 'absolute', top: '-28px', left: '24px' }}>
          <img src={logo} alt="Home" style={{ width: '192px', height: '192px', objectFit: 'contain' }} />
        </Link>

        <div className="glass-panel membership-cta" >
          <div className="cta-split">
            <div style={{ alignItems: 'center' ,width: '450px',objectFit: 'contain'}}>
              <h2>Not a Member?</h2>
              <p>Become a member, and join us on the journey to connect people, animals and the natural world to save wildlife. YOU make a difference in the success and growth of the Coog Zoo and its thousands of treasured species. Memberships are valid for one full year, and include many engaging benefits for individuals and families.</p>
            </div>
            <div style={{ alignItems: 'center' ,width: '450px',objectFit: 'contain'}}>
              <h2>Already a Member?</h2>
              <p>
                Members can visit the Zoo anytime without needing a reservation. You can view your membership status by logging in.
                <br />
                <br />
                Pro-tip: Bookmark the Member Portal page on your mobile device so you can quickly access your digital membership card before arriving to the Zoo. Thank you for being a valued Zoo member and helping save animals in the wild!</p>
            </div>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="plans-grid">
          {plans.map(plan => (
            <div
              key={plan.type}
              className={`glass-panel plan-card ${selected === plan.type ? 'plan-selected' : ''}`}
              onClick={() => handleChoosePlan(plan)}
            >
              {plan.featured && <div className="plan-badge">Best Value</div>}
              <h2 className="plan-name">{plan.name}</h2>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-pricing">
                <span className="plan-price">${(plan.price_cents / 100).toFixed(2)}</span>
                <span className="plan-period">/ {plan.period}</span>
              </div>
              <ul className="plan-perks">
                {plan.perks.map((perk, i) => (
                  <li key={i} className="perk-item">
                    <span>➥</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`glass-button plan-button ${selected === plan.type ? 'plan-button-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoosePlan(plan);
                }}
              >
                {selected === plan.type ? 'Selected' : 'Choose Plan'}
              </button>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass-panel membership-cta">
          <h2>Ready to Join?</h2>
          <p>Select a plan above and become a Member today!</p>
          <button className="glass-button cta-button" onClick={handleSignUp}>
            Check Out
          </button>
        </div>

      </div>
    </div>
  );
}
