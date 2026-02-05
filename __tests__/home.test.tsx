import { render } from '@testing-library/react-native';
import Home from '@/app/(tabs)/home';

describe( 'Home screen', () => {
    it( 'check text on Home screen', () => {
        const { getByText } = render ( <Home /> );
        expect( getByText( ' Welcome to ReelRater' )).toBeTruthy();
    });
});