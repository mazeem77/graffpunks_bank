import React from 'react';
import { BrowserRouter, Switch, Route } from 'react-router-dom';
import { Footer } from 'components';
// import { Header, Footer } from 'components';
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
            {/* <Header /> */}

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

            <Footer />
          </div>
        </AppStateProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;
