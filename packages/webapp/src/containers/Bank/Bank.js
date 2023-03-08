import { useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useAppState } from 'components/AppStateProvider';
import { TelegramUser, Button, Loader } from '../../components';
import styles from './Bank.module.scss';

function Converter() {
  const { waxTransaction } = useAppState();
  const [tokens, setTokens] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const onChange = event => {
    setTokens(event.currentTarget.value);
  };

  const convert = async () => {
    try {
      setLoading(true);
      await waxTransaction(tokens);
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError(true);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(null);
    setTokens(1000);
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <section className={styles.convertSection}>
        <div>Something went wrong</div>

        <Button onClick={() => reset()} className={styles.button}>
          Go back
        </Button>
      </section>
    );
  }

  if (success) {
    return (
      <section className={styles.convertSection}>
        <div>Transaction completed successfully</div>

        <Button onClick={() => reset()} className={styles.button}>
          Go back
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.convertSection}>
      <div>
        Buy{' '}
        <select placeholder="Select tokens amount" onChange={onChange} value={tokens}>
          <option value="1000">1000 TOKENS</option>
          <option value="5000">5000 TOKENS</option>
          <option value="10000">10000 TOKENS</option>
          <option value="20000">20000 TOKENS</option>
          <option value="25000">25000 TOKENS</option>
          <option value="50000">50000 TOKENS</option>
          <option value="100000">100000 TOKENS</option>
          <option value="250000">250000 TOKENS</option>
          <option value="500000">500000 TOKENS</option>
          <option value="1000000">1000000 TOKENS</option>
        </select>{' '}
        for {tokens} LFGK
      </div>

      <Button onClick={() => convert()} className={styles.button}>
        Buy tokens
      </Button>
    </section>
  );
}

export default function Bank() {
  const { loggedUser, waxUser } = useAppState();

  if (!loggedUser || !waxUser) {
    return <Redirect to="/wallet" />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.message}>
        <strong>{waxUser.account}</strong> is connected to the <TelegramUser loggedUser={loggedUser} />
      </div>

      <Converter />
    </div>
  );
}
