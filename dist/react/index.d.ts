import * as react_jsx_runtime from 'react/jsx-runtime';
import { ChangelogFile } from '../schemas/index.js';
import 'zod';

type ChangelogListLabels = {
    empty: string;
};
type ChangelogListProps = {
    data: ChangelogFile;
    commitUrl: (ref: string) => string;
    labels?: Partial<ChangelogListLabels>;
    className?: string;
};
declare function ChangelogList({ data, commitUrl, labels, className }: ChangelogListProps): react_jsx_runtime.JSX.Element;

export { ChangelogList, type ChangelogListLabels, type ChangelogListProps };
