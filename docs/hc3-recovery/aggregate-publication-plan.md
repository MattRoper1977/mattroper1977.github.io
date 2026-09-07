The aggregate production verifier invokes EchoVault and Relicforge without RF_PUBLICATION=games, so they read the old single-domain shelf contract. The individual workflows already use the measured Play adapter.

Rollback before implementation: Site 6eca0a5be75a7669d2c02561bbe86a931ff76a80. This PR will select the existing adapter at the aggregate call site, keep all five checks and their failure aggregation, and preserve their logs/artifacts. No game, Science pack or PR-owned page changes.

Required firing control: real workflow environment selects Play, one scratch removal selects the obsolete path and must fail the caller contract, restoration passes. Both published-shelf browser adapters retain their own live and planted controls. Post-merge workflow must run and its artifact be read before closure.
