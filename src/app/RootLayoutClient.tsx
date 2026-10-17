'use client';

import { CloudProvider } from '@/context/CloudContext';
import { SelectionProvider } from '@/context/SelectionContext';
import { RackProvider } from '@/context/RackContext';
import { SavedBlendsProvider } from '@/context/SavedBlendsContext';
import { ReactNode } from 'react';

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  return (
    <CloudProvider>
      <SelectionProvider>
        <RackProvider>
          <SavedBlendsProvider>{children}</SavedBlendsProvider>
        </RackProvider>
      </SelectionProvider>
    </CloudProvider>
  );
}
