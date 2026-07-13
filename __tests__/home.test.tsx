import { render } from '@testing-library/react-native';
import Home from '@/app/(tabs)/home';

describe( 'Home screen', () => {
    it( 'shows the app title', () => {
        const { getByText } = render ( <Home /> );
        expect( getByText( ' Welcome to ReelRater' )).toBeTruthy();
    });
});
