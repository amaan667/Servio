package EventSystem;

import java.util.ArrayList;
import java.util.List;


public class ListenerMaintainer <T> { //Maintains a list of something
    private List<T> list = new ArrayList<T>(); //Creates a list of valid listeners of some type given to us.

    public ListenerMaintainer() {}

    //Adds listener to the list
    public void addListener(T toAdd) {
        if (!list.contains(toAdd)) { //If the list does not already have it
            list.add(toAdd);
        }
    }

    //Remove listener
    public void removeListener(T toRemove) {
        if (list.contains(toRemove)) { //Make sure we don't try to remove something which isn't in the list
            list.remove(toRemove);
        }
    }

    public List<T> getList() {
        return list;
    }
}
