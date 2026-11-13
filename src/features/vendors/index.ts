// vendors 도메인 공개 API(배럴).
export { useVendors, useVendorsByArea, useCreateVendor, useUpdateVendor, useDeleteVendor } from './hooks';
export { selectVendors, selectVendorsByArea, hasVisibleVendors, findLinkedExpense, ROLE_LABEL, STATUS_LABEL } from './api';
export type { CreateVendorInput, UpdateVendorInput } from './api';
export type { AreaVendorGroup } from './types';
export { VendorForm, type VendorFormValue } from './components/vendor-form';
export { VendorContractPanel } from './components/vendor-contract-panel';
export { VendorCandidateRow } from './components/vendor-candidate-row';
