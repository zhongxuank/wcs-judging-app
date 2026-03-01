import { Layout } from './components/common/Layout';
import { CompetitionSetup } from './components/competition/CompetitionSetup';

function App() {
    return (
        <Layout>
            <div className="space-y-8">
                <CompetitionSetup />
            </div>
        </Layout>
    );
}

export default App;
