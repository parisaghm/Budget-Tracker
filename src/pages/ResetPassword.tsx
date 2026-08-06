import { Navigate, useLocation } from "react-router-dom";

/** Legacy recovery path — redirect to the current update-password route. */
export default function ResetPassword() {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: "/update-password",
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}
