import React from 'react';
import { BrowserRouter, Switch, Route } from 'react-router-dom';
import { Footer } from 'components';
import { Header } from 'components';
import { I18nProvider } from 'i18n';
import { AppStateProvider } from '../AppStateProvider';
import './App.scss';

import Wallet from 'containers/Wallet';
import Bank from 'containers/Bank';

function App () {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AppStateProvider>
          <div className='app-container'>
            <div className='header-style'>
              <Header />
            </div>

            <main className='main'>
              <Switch>
                <Route exact path='/'>
                  <Wallet />
                </Route>

                <Route exact path='/bank'>
                  <Bank />
                </Route>
              </Switch>
            </main>
            <div className='footer-visible'>
              <Footer />
            </div>
          </div>
        </AppStateProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;
