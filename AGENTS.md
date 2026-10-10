<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep authenticated app navigation centralized in `AppShell`, including shared mobile navigation, so page access stays consistent across routes.
- Keep offline persistence user-scoped in IndexedDB, and route queued expense/attendance writes through one shared sync module so reconnect retries remain idempotent.
