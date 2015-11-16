/*
 * Copyright (C) 2015 B3Partners B.V.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
package nl.b3p.web;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.servlet.http.HttpSession;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

/**
 * Maintain a list of active sessions on the application to provide a means of
 * sharing session data.
 *
 * @author Mark Prins <mark@b3partners.nl>
 */
public class SharedSessionData implements HttpSessionListener {
    private static final Log log = LogFactory.getLog(SharedSessionData.class);
    /**
     * The map that holds a map per sessionid.
     */
    private static final Map<String, Map<String, String>> sessions = new ConcurrentHashMap< String, Map<String, String>>();

    public void sessionCreated(HttpSessionEvent event) {
        HttpSession session = event.getSession();
        log.debug("adding a map for session: " + session.getId());
        sessions.put(session.getId(), new ConcurrentHashMap<String, String>(8));
    }

    public void sessionDestroyed(HttpSessionEvent event) {
        log.debug("removing data for session: " + event.getSession().getId());
        sessions.remove(event.getSession().getId());
    }

    /**
     * Find the stored data and return that, if not found return an empty map.
     * <strong>
     * Do NOT under any circumstance store sensitive information in the map
     * obtained from this object.
     * </strong>
     *
     * @param sessionId the key to look for
     * @return a Map with the stored data
     */
    public static Map<String, String> find(String sessionId) {
        log.debug("Looking for data associated with session: " + sessionId);
        if (sessions.containsKey(sessionId)) {
            return sessions.get(sessionId);
        } else {
            return Collections.EMPTY_MAP;
        }
    }

}
