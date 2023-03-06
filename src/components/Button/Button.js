import React from 'react';
import './Button.scss';

const Button = ({ icon, children, onClick, className }) => (
  <button onClick={onClick} className={`button ${className || ''}`}>
    {icon && <i className="button__icon">{icon}</i>}
    {children && <span className="button__text">{children}</span>}
  </button>
);

export default Button;
