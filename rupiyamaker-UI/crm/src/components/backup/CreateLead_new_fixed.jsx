import React, { useRef, useState, useEffect } from "react";

// --- Logic and State Hook ---
function useCreateLeadLogic() {
  // Simulate backend for banks
  const [bankList, setBankList] = useState([]);

  // --- Customer Obligation summary from backend (simulate) ---
  const [totalBtPos, setTotalBtPos] = useState("0");
  const [totalObligation, setTotalObligation] = useState("0");

  const assigneeList = [
    { value: "", label: "Select Assignee" },
    { value: "john_doe", label: "John Doe" },
    { value: "jane_smith", label: "Jane Smith" },
    { value: "robert_brown", label: "Robert Brown" },
    { value: "priya_sharma", label: "Priya Sharma" },
    { value: "amit_kumar", label: "Amit Kumar" },
  ];

  const [assignedTo, setAssignedTo] = useState([]);
  const [showAssignPopup, setShowAssignPopup] = useState(false);

  // Function to remove an assignee
  const handleRemoveAssignee = (nameToRemove) => {
    setAssignedTo((prev) => prev.filter((name) => name !== nameToRemove));
  };

  // Function to add an assignee from the popup
  const handleAddAssignee = (newAssigneeName) => {
    setAssignedTo((prevAssignedTo) => {
      if (!prevAssignedTo.includes(newAssigneeName)) {
        return [...prevAssignedTo, newAssigneeName];
      }
      return prevAssignedTo;
    });
  };

  return {
    assigneeList,
    assignedTo,
    setAssignedTo,
    showAssignPopup,
    setShowAssignPopup,
    handleRemoveAssignee,
    handleAddAssignee
  };
}

// Main Component 
export default function CreateLeadNew() {
  const {
    assigneeList,
    assignedTo,
    setAssignedTo,
    showAssignPopup,
    setShowAssignPopup,
    handleRemoveAssignee,
    handleAddAssignee
  } = useCreateLeadLogic();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create Lead</h1>
      
      {/* Assignee Section */}
      <div className="form-group mb-4">
        <label className="block mb-2 text-md font-bold text-black form-label required-field">
          Assigned To<span className="ml-1 text-red-400">*</span>
        </label>
        <div className="relative">
          <div 
            className="w-full px-3 py-2 text-white border rounded-lg border-neutral-800 bg-neutral-800 focus:outline-none focus:border-sky-400 min-h-[40px] flex flex-wrap gap-2 items-center cursor-pointer"
            onClick={() => setShowAssignPopup(true)}
          >
            {assignedTo.length === 0 && (
              <span className="text-gray-400">Click to select assignees</span>
            )}
            
            {assignedTo.map((assignee) => (
              <div 
                key={assignee}
                className="flex items-center gap-2 bg-gray-700 pl-2 pr-1 py-1 rounded-md text-sm"
              >
                {/* Profile icon with initials */}
                <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center flex-shrink-0">
                  {assignee.split(' ')
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span>{assignee}</span>
                <button
                  type="button"
                  className="text-gray-300 hover:text-white ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAssignee(assignee);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            
            {/* Add button */}
            {assignedTo.length > 0 && (
              <button
                type="button"
                className="w-6 h-6 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssignPopup(true);
                }}
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition">
        Create
      </button>

      {/* AssignPopup component */}
      {showAssignPopup && (
        <AssignPopup
          onClose={() => setShowAssignPopup(false)}
          onSelect={(user) => {
            handleAddAssignee(user);
            setShowAssignPopup(false);
          }}
        />
      )}
    </div>
  );
}

// AssignPopup component
function AssignPopup({ onClose, onSelect }) {
  const [assigneeName, setAssigneeName] = useState("");

  // Using the same assignee list from the parent component
  const dummyAssignees = [
  ];

  const [filteredAssignees, setFilteredAssignees] = useState(dummyAssignees);

  useEffect(() => {
    // If assigneeName is empty, show all dummyAssignees
    if (assigneeName.trim() === "") {
      setFilteredAssignees(dummyAssignees);
    } else {
      // Otherwise, filter based on input
      setFilteredAssignees(
        dummyAssignees.filter((name) =>
          name.toLowerCase().includes(assigneeName.toLowerCase())
        )
      );
    }
  }, [assigneeName]); // Depend on assigneeName to re-filter

  const handleAssign = () => {
    if (assigneeName) {
      onSelect(assigneeName);
    }
    // Optionally, clear the input after assigning
    setAssigneeName("");
    onClose(); // Close the popup after assigning
  };

  const selectAssignee = (selectedName) => {
    setAssigneeName(selectedName); // Set the selected name in the input
    onSelect(selectedName); // Pass the selected name to the parent
    onClose(); // Close the popup
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
    >
      <div className="bg-transparent backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-[90%] max-w-md mx-auto relative">
        <div className="flex items-center mb-4 bg-white bg-opacity-90 p-3 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-lg text-black">Assign Lead</h3>
        </div>

        <div className="mb-4 bg-white bg-opacity-90 p-3 rounded-md">
          <label className="block font-bold text-gray-700 mb-2">
            Assign to
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-3 py-2 border border-cyan-400 rounded text-black font-bold"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Search or enter assignee name"
            />
            {assigneeName && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                onClick={() => setAssigneeName("")}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Always show the list, filtered or full */}
        <ul className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
          {filteredAssignees.length > 0 ? (
            filteredAssignees.map((name) => (
              <li
                key={name}
                className="p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center"
                onClick={() => selectAssignee(name)}
              >
                {/* Profile icon with initials or avatar */}
                <div className="w-8 h-8 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 flex-shrink-0">
                  {name.split(' ')
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span>{name}</span>
              </li>
            ))
          ) : (
            assigneeName.trim() !== "" && ( // Only show "No results" if user typed something and no results
              <li className="p-3 text-gray-500 text-center">No matching assignees found.</li>
            )
          )}
        </ul>

        <div className="flex justify-end gap-4 mt-4 bg-white bg-opacity-90 p-3 rounded-b-xl">
          <button
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition"
            onClick={handleAssign}
          >
            Assign
          </button>
          <button
            className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-2xl font-bold"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}
