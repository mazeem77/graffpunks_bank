import { Button } from '../index';
import styles from './TelegramUser.module.scss';

function TelegramUser({ loggedUser, logout }) {
  return (
    <div className={styles.loggedUser}>
      <img className={styles.userPhoto} src={loggedUser.photo_url} alt="user-avatar" />{' '}
      <strong>{loggedUser.username}</strong>
      {logout && (
        <Button className={styles.userLogoutButton} onClick={() => logout()}>
          Log out
        </Button>
      )}
    </div>
  );
}

export default TelegramUser;
