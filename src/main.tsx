import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { OutputApp } from './OutputApp';
import './styles.css';
import './extensions.css';
const output=location.hash==='#/output';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{output?<OutputApp/>:<App/>}</React.StrictMode>);
