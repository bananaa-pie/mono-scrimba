import React from 'react';
import { Check } from 'lucide-react';

const PricingPage = () => {
  const tiers = [
    { name: 'Студент', price: 'Бесплатно', features: ['Доступ к открытым курсам', 'Песочница Go', 'Базовый ИИ-ментор'], btn: 'Начать' },
    { name: 'Pro', price: '990 ₽', features: ['Все курсы платформы', 'Неограниченная запись', 'Приоритетный ментор', 'Сертификат'], btn: 'Стать Pro', highlight: true }
  ];

  return (
    <div style={{ background: '#1e1e1e', minHeight: '100vh', color: 'white', padding: '60px 20px', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 style={{ fontSize: '48px', margin: '0 0 10px 0' }}>Выбери свой путь в <span style={{color: '#00add8'}}>Go</span></h1>
        <p style={{ color: '#888', fontSize: '18px' }}>Начни учиться бесплатно или стань профи</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
        {tiers.map((tier) => (
          <div key={tier.name} style={{
            background: '#252526', border: tier.highlight ? '2px solid #00add8' : '1px solid #333',
            borderRadius: '16px', padding: '40px', width: '320px', position: 'relative',
            transform: tier.highlight ? 'scale(1.05)' : 'none'
          }}>
            {tier.highlight && <div style={{ position: 'absolute', top: '-15px', right: '20px', background: '#00add8', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>ПОПУЛЯРНОЕ</div>}
            <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>{tier.name}</h2>
            <div style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '20px' }}>{tier.price}</div>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px' }}>
              {tier.features.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#aaa' }}>
                  <Check size={18} color="#22c55e" /> {f}
                </li>
              ))}
            </ul>
            <button style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: tier.highlight ? '#00add8' : '#333', color: 'white',
              fontWeight: 'bold', cursor: 'pointer', fontSize: '16px'
            }}>{tier.btn}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;